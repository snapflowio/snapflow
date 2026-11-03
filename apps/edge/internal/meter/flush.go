// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package meter

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/edge/internal/control"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

type apiUsageError struct{ err error }

func (ingestError *apiUsageError) Error() string { return ingestError.err.Error() }

func (ingestError *apiUsageError) Unwrap() error { return ingestError.err }

func (meter *Meter) Run(ctx context.Context) error {
	ticker := time.NewTicker(flushInterval)
	defer ticker.Stop()
	if err := meter.flushOrLog(ctx, "could not ingest queued Edge usage"); err != nil {
		return err
	}
	if err := meter.requireCapacity(); err != nil {
		return err
	}
	for {
		select {
		case <-ctx.Done():
			return meter.final(ctx)
		case endedAt := <-ticker.C:
			if err := meter.cycle(ctx, endedAt); err != nil {
				return err
			}
		}
	}
}

func (meter *Meter) cycle(ctx context.Context, endedAt time.Time) error {
	if err := meter.rotate(endedAt); err != nil {
		return fmt.Errorf("persist Edge usage interval: %w", err)
	}
	if err := meter.flushOrLog(ctx, "could not ingest Edge usage"); err != nil {
		return err
	}
	return meter.requireCapacity()
}

func (meter *Meter) final(ctx context.Context) error {
	shutdownContext, cancel := context.WithTimeout(context.WithoutCancel(ctx), flushRequestTimeout)
	defer cancel()
	if err := meter.rotate(time.Now()); err != nil {
		return fmt.Errorf("persist final Edge usage interval: %w", err)
	}
	return meter.flushOrLog(shutdownContext, "could not ingest final Edge usage")
}

func (meter *Meter) flushOrLog(ctx context.Context, message string) error {
	return meter.handleFlushError(message, meter.flush(ctx))
}

func (meter *Meter) requireCapacity() error {
	if meter.intervals.hasIntervalCapacity() {
		return nil
	}
	return fmt.Errorf("%w; refusing new traffic before usage can become unmetered", ErrQueueCapacity)
}

func (meter *Meter) flush(ctx context.Context) error {
	epochOpenedForHead := false
	for {
		interval, cursor, err := meter.intervals.peek()
		if err != nil {
			return fmt.Errorf("read queued Edge usage: %w", err)
		}
		if interval == nil {
			return nil
		}
		if cursor.Epoch == 0 {
			if err := meter.openEpoch(ctx); err != nil {
				return err
			}
			continue
		}
		epochOpenedForHead, err = meter.ingestHead(ctx, *interval, cursor, epochOpenedForHead)
		if err != nil {
			return err
		}
	}
}

func (meter *Meter) ingestHead(
	ctx context.Context,
	interval usageInterval,
	cursor queueCursor,
	epochOpenedForHead bool,
) (bool, error) {
	signed, err := signCheckpoint(meter.signer, cursor, interval)
	if err != nil {
		return epochOpenedForHead, err
	}
	requestContext, cancel := context.WithTimeout(ctx, flushRequestTimeout)
	acknowledgement, err := meter.control.IngestUsageCheckpoint(requestContext, signed)
	cancel()
	switch {
	case apierror.HasStatus(err, http.StatusGone) && !epochOpenedForHead:
		return true, meter.openEpoch(ctx)
	case apierror.HasStatus(err, http.StatusUnprocessableEntity) || apierror.HasStatus(err, http.StatusConflict):
		return epochOpenedForHead, meter.discardHead(signed, err)
	case err != nil:
		return epochOpenedForHead, &apiUsageError{err: fmt.Errorf(
			"ingest Edge usage checkpoint %d/%s: %w",
			signed.UsageEpoch,
			signed.Sequence,
			err,
		)}
	default:
		return false, meter.acknowledge(signed, acknowledgement)
	}
}

func (meter *Meter) openEpoch(ctx context.Context) error {
	requestContext, cancel := context.WithTimeout(ctx, flushRequestTimeout)
	opened, err := meter.control.OpenUsageEpoch(requestContext)
	cancel()
	if err != nil {
		return &apiUsageError{err: fmt.Errorf("open Edge usage epoch: %w", err)}
	}
	anchor := ""
	if opened.PreviousDigest != nil {
		anchor = *opened.PreviousDigest
	}
	if err := meter.intervals.beginEpoch(opened.UsageEpoch, anchor); err != nil {
		return fmt.Errorf("persist Edge usage epoch %d: %w", opened.UsageEpoch, err)
	}
	meter.logger.Info("opened Edge usage epoch", "epoch", opened.UsageEpoch)
	return nil
}

func (meter *Meter) discardHead(signed apiclient.EdgeUsageCheckpointDto, rejection error) error {
	if err := meter.intervals.discardHead(); err != nil {
		return fmt.Errorf("discard rejected Edge usage interval: %w", err)
	}
	meter.discardedIntervals.Add(1)
	meter.logger.Error(
		"Snapflow API permanently rejected an Edge usage interval; discarded it",
		"epoch", signed.UsageEpoch,
		"sequence", signed.Sequence,
		"interval_started_at", signed.IntervalStartedAt,
		"samples", len(signed.Samples),
		"error", rejection,
	)
	return nil
}

func (meter *Meter) acknowledge(
	signed apiclient.EdgeUsageCheckpointDto,
	acknowledgement *apiclient.EdgeUsageCheckpointAcknowledgementDto,
) error {
	if acknowledgement == nil || acknowledgement.UsageEpoch != signed.UsageEpoch ||
		acknowledgement.Sequence != signed.Sequence || acknowledgement.Digest != signed.Digest {
		return &apiUsageError{err: errors.New("edge usage acknowledgement does not match the checkpoint")}
	}
	sequence, err := parseSequence(acknowledgement.Sequence)
	if err != nil {
		return err
	}
	if err := meter.intervals.acknowledge(acknowledgement.UsageEpoch, sequence, acknowledgement.Digest); err != nil {
		return fmt.Errorf("acknowledge ingested Edge usage: %w", err)
	}
	return nil
}

func (meter *Meter) handleFlushError(message string, err error) error {
	var apiError *apiUsageError
	if !errors.As(err, &apiError) {
		return err
	}
	if control.IsRetryable(apiError) {
		meter.logger.Debug(message, "error", apiError)
		return nil
	}
	meter.logger.Warn(message, "error", apiError)
	return nil
}
