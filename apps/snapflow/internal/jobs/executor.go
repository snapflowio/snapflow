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
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/snapflowio/snapflow/internal/control"
	"github.com/snapflowio/snapflow/internal/jobs/canary"
	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	"github.com/snapflowio/snapflow/internal/sandbox"
	"github.com/snapflowio/snapflow/internal/state"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
)

const (
	traceParentHeader = "traceparent"
	traceStateHeader  = "tracestate"
	tracerName        = "github.com/snapflowio/snapflow/jobs"
	jobSpanPrefix     = "job."
)

type ExecutorConfig struct {
	RuntimeIdentity        string
	ReleaseIdentity        string
	QualificationDirectory string
}

type ExecutorDependencies struct {
	Client        *control.Client
	Runtime       sandboxruntime.SandboxRuntime
	Outbox        *Outbox
	LocalRuntimes *sandbox.LocalRuntimes
	Converger     canary.Converger
	Snapshots     Snapshots
	Session       control.SessionCredentials
	Identity      *state.Identity
	HostInventory func(context.Context) (*machinev1alpha1.HostInventory, error)
}

type Executor struct {
	log                    *slog.Logger
	client                 *control.Client
	runtime                sandboxruntime.SandboxRuntime
	outbox                 *Outbox
	localRuntimes          *sandbox.LocalRuntimes
	converger              canary.Converger
	snapshots              Snapshots
	session                control.SessionCredentials
	runtimeIdentity        string
	releaseIdentity        string
	identity               *state.Identity
	qualificationDirectory string
	hostInventory          func(context.Context) (*machinev1alpha1.HostInventory, error)
	inFlightMu             sync.Mutex
	inFlight               map[string]*execution
	lease                  leaseTiming
}

func NewExecutor(cfg ExecutorConfig, deps ExecutorDependencies, opts ...Option) (*Executor, error) {
	if deps.Client == nil || deps.Runtime == nil || deps.Outbox == nil || deps.LocalRuntimes == nil || deps.Converger == nil || deps.Snapshots == nil {
		return nil, errors.New("executor control-plane client, sandbox runtime, outbox, local runtimes, converger and snapshots are required")
	}
	if err := deps.Session.Validate(); err != nil {
		return nil, err
	}
	if strings.TrimSpace(cfg.RuntimeIdentity) == "" || strings.TrimSpace(cfg.ReleaseIdentity) == "" {
		return nil, errors.New("the Snapflow runtime and release identities are required")
	}
	if deps.Identity == nil || strings.TrimSpace(cfg.QualificationDirectory) == "" {
		return nil, errors.New("machine qualification identity and work directory are required")
	}
	if deps.HostInventory == nil {
		return nil, errors.New("machine inventory collector is required")
	}
	return &Executor{
		log:                    newOptions(opts).logger.With(slog.String("component", "executor")),
		client:                 deps.Client,
		runtime:                deps.Runtime,
		outbox:                 deps.Outbox,
		localRuntimes:          deps.LocalRuntimes,
		converger:              deps.Converger,
		snapshots:              deps.Snapshots,
		session:                deps.Session,
		runtimeIdentity:        strings.TrimSpace(cfg.RuntimeIdentity),
		releaseIdentity:        strings.TrimSpace(cfg.ReleaseIdentity),
		identity:               deps.Identity,
		qualificationDirectory: cfg.QualificationDirectory,
		hostInventory:          deps.HostInventory,
		inFlight:               make(map[string]*execution),
		lease:                  defaultLeaseTiming(),
	}, nil
}

func (e *Executor) Execute(ctx context.Context, job *apiclient.Job) {
	executionContext, claimed, admitted := e.admit(ctx, job)
	if !admitted {
		return
	}
	defer e.release(job.Id, claimed)

	executionContext = e.extractTraceContext(executionContext, job)
	executionContext, span := otel.Tracer(tracerName).Start(
		executionContext,
		jobSpanPrefix+strings.ToLower(string(job.Type)),
		trace.WithAttributes(jobAttributes(job)...),
	)
	defer span.End()
	jobLog := e.jobLogger(executionContext, job)
	jobLog.InfoContext(executionContext, "Executing job")

	startedAt := time.Now()
	resultMetadata, err := e.executeWithLeaseRenewal(executionContext, claimed, job)
	if abandoned := abandonedAttempt(ctx, err); abandoned != "" {
		jobLog.WarnContext(executionContext, "Job attempt abandoned; leaving it to the control plane", "reason", abandoned, "error", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, abandoned)
		return
	}
	e.submit(context.WithoutCancel(executionContext), job, jobLog, span, resultMetadata, err, time.Since(startedAt))
}

func abandonedAttempt(ctx context.Context, err error) string {
	switch {
	case err == nil:
		return ""
	case ctx.Err() != nil:
		return "job interrupted by Snapflow shutdown"
	case errors.Is(err, errLeaseLost):
		return "job lease was lost"
	default:
		return ""
	}
}

func (e *Executor) submit(
	ctx context.Context,
	job *apiclient.Job,
	jobLog *slog.Logger,
	span trace.Span,
	metadata any,
	err error,
	duration time.Duration,
) {
	if err != nil {
		jobLog.ErrorContext(ctx, "Job failed", "error", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, "job execution failed")
	} else {
		jobLog.InfoContext(ctx, "Job completed successfully")
	}
	result, encodeErr := e.jobResult(job, metadata, err, duration)
	if encodeErr != nil {
		jobLog.ErrorContext(ctx, "Failed to encode job result", "error", encodeErr)
		return
	}
	if submitErr := e.outbox.Submit(ctx, result); submitErr != nil {
		jobLog.ErrorContext(ctx, "Failed to record job result", "error", submitErr)
	}
}

func jobAttributes(job *apiclient.Job) []attribute.KeyValue {
	attributes := []attribute.KeyValue{
		attribute.String("job.id", job.Id),
		attribute.String("job.type", string(job.Type)),
		attribute.String("job.status", string(job.Status)),
	}
	if resourceID := job.ResourceId; resourceID != "" {
		attributes = append(attributes, attribute.String("resource.id", resourceID))
	}
	if resourceType := job.ResourceType; resourceType != "" {
		attributes = append(attributes, attribute.String("resource.type", string(resourceType)))
	}
	return attributes
}

func (e *Executor) jobLogger(ctx context.Context, job *apiclient.Job) *slog.Logger {
	jobLog := e.log.With(
		slog.String("job_id", job.Id),
		slog.String("job_type", string(job.Type)),
	)
	if resourceType := job.ResourceType; resourceType != "" {
		jobLog = jobLog.With(slog.String("resource_type", string(resourceType)))
	}
	if resourceID := job.ResourceId; resourceID != "" {
		jobLog = jobLog.With(slog.String("resource_id", resourceID))
	}
	if spanContext := trace.SpanContextFromContext(ctx); spanContext.IsValid() {
		jobLog = jobLog.With(
			slog.String("trace_id", spanContext.TraceID().String()),
			slog.String("span_id", spanContext.SpanID().String()),
		)
	}
	return jobLog
}

func (e *Executor) extractTraceContext(ctx context.Context, job *apiclient.Job) context.Context {
	if job.TraceContext == nil || len(*job.TraceContext) == 0 {
		return ctx
	}
	carrier := propagation.MapCarrier{}
	for key, value := range *job.TraceContext {
		normalizedKey := strings.ToLower(key)
		switch normalizedKey {
		case traceParentHeader, traceStateHeader:
			carrier[normalizedKey] = value
		}
	}
	extracted := otel.GetTextMapPropagator().Extract(ctx, carrier)
	spanContext := trace.SpanContextFromContext(extracted)
	if !spanContext.IsValid() {
		e.log.WarnContext(
			ctx,
			"Job trace context is invalid",
			slog.String("job_id", job.Id),
		)
		return ctx
	}
	e.log.DebugContext(
		extracted,
		"Extracted job trace context",
		slog.String("job_id", job.Id),
		slog.String("trace_id", spanContext.TraceID().String()),
		slog.Bool("sampled", spanContext.IsSampled()),
	)
	return extracted
}
