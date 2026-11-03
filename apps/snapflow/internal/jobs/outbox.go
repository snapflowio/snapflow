// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package jobs

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/snapflow/internal/control"
	"github.com/snapflowio/snapflow/internal/state"
	"github.com/snapflowio/tunnel-go/reconnect"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

const (
	updateStatusSpan      = "job.update_status"
	resultDeliveryTimeout = 30 * time.Second
)

type ResultStore interface {
	SaveJobResult(context.Context, state.JobResult) error
	DeleteJobResult(context.Context, state.JobResult) error
	LoadJobResult(context.Context, string) (state.JobResult, bool, error)
	LoadJobResults(context.Context) ([]state.JobResult, []state.DeadLetter, error)
}

type Outbox struct {
	log     *slog.Logger
	client  *control.Client
	store   ResultStore
	pending chan struct{}
}

func NewOutbox(client *control.Client, store ResultStore, opts ...Option) (*Outbox, error) {
	if client == nil || store == nil {
		return nil, errors.New("job result outbox control-plane client and store are required")
	}
	return &Outbox{
		log:     newOptions(opts).logger.With(slog.String("component", "job_results")),
		client:  client,
		store:   store,
		pending: make(chan struct{}, 1),
	}, nil
}

func (outbox *Outbox) Submit(ctx context.Context, result state.JobResult) error {
	if err := outbox.store.SaveJobResult(ctx, result); err != nil {
		return err
	}
	if !outbox.deliver(ctx, result) {
		outbox.wake()
	}
	return nil
}

func (outbox *Outbox) Delivered(ctx context.Context, jobID string, leaseToken uuid.UUID, attempt int32) (bool, error) {
	result, found, err := outbox.store.LoadJobResult(ctx, jobID)
	var quarantined *state.QuarantinedError
	if errors.As(err, &quarantined) {
		state.LogDeadLetters(ctx, outbox.log, []state.DeadLetter{quarantined.DeadLetter})
		return false, nil
	}
	if err != nil || !found {
		return false, err
	}
	if !result.Matches(leaseToken, attempt) {
		return false, nil
	}
	outbox.wake()
	return true, nil
}

func (outbox *Outbox) Run(ctx context.Context) error {
	failures := reconnect.DefaultBackoff()
	retry := time.NewTimer(0)
	retry.Stop()
	defer retry.Stop()
	for {
		if outbox.resend(ctx) {
			failures.Reset()
		} else {
			retry.Reset(failures.Next())
		}
		select {
		case <-ctx.Done():
			return nil
		case <-outbox.pending:
			retry.Stop()
		case <-retry.C:
		}
	}
}

func (outbox *Outbox) wake() {
	select {
	case outbox.pending <- struct{}{}:
	default:
	}
}

func (outbox *Outbox) resend(ctx context.Context) bool {
	results, quarantined, err := outbox.store.LoadJobResults(ctx)
	if err != nil {
		if ctx.Err() == nil {
			outbox.log.ErrorContext(ctx, "Failed to load pending job results", "error", err)
		}
		return false
	}
	state.LogDeadLetters(ctx, outbox.log, quarantined)
	delivered := true
	for _, result := range results {
		if ctx.Err() != nil {
			return false
		}
		delivered = outbox.deliver(ctx, result) && delivered
	}
	return delivered
}

func (outbox *Outbox) deliver(ctx context.Context, result state.JobResult) bool {
	err := outbox.report(ctx, result)
	if err != nil && !control.IsRefusal(err) {
		if ctx.Err() == nil {
			outbox.log.WarnContext(ctx, "Job result delivery failed; it will be resent", "job_id", result.JobID, "error", err)
		}
		return false
	}
	if err != nil {
		outbox.log.WarnContext(ctx, "Control plane refused a job result; dropping it", "job_id", result.JobID, "error", err)
	}
	if deleteErr := outbox.store.DeleteJobResult(ctx, result); deleteErr != nil {
		outbox.log.ErrorContext(ctx, "Failed to forget a settled job result", "job_id", result.JobID, "error", deleteErr)
		return false
	}
	return true
}

func (outbox *Outbox) report(ctx context.Context, result state.JobResult) error {
	ctx, span := otel.Tracer(tracerName).Start(
		ctx,
		updateStatusSpan,
		trace.WithSpanKind(trace.SpanKindClient),
		trace.WithAttributes(
			attribute.String("job.id", result.JobID),
			attribute.String("job.status", string(result.Update.Status)),
		),
	)
	defer span.End()
	requestContext, cancel := context.WithTimeout(ctx, resultDeliveryTimeout)
	defer cancel()
	operation := fmt.Sprintf("update job %s status to %s", result.JobID, result.Update.Status)
	response, err := outbox.client.UpdateJobStatusWithResponse(requestContext, result.JobID, result.Update)
	described := apierror.CheckResponse(operation, response, err)
	if described != nil {
		span.RecordError(described)
		span.SetStatus(codes.Error, "job status update failed")
	}
	return described
}
