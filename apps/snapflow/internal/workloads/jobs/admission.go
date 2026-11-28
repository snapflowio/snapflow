// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package jobs

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

type execution struct {
	attempt int32
	cancel  context.CancelCauseFunc
	done    chan struct{}
}

func (e *Executor) admit(ctx context.Context, job *apiclient.Job) (context.Context, *execution, bool) {
	if job == nil {
		e.log.ErrorContext(ctx, "Refusing to execute a nil job")
		return nil, nil, false
	}
	if !hasValidLease(job) {
		e.log.ErrorContext(ctx, "Refusing to execute a job without a valid lease", "job_id", job.Id, "attempt", job.Attempt)
		return nil, nil, false
	}
	executionContext, claimed, found := e.claim(ctx, job)
	if !found {
		return nil, nil, false
	}
	finished, err := e.outbox.Delivered(ctx, job.Id, *job.LeaseToken, job.Attempt)
	if err != nil || finished {
		e.release(job.Id, claimed)
		if err != nil {
			e.log.ErrorContext(ctx, "Failed to look up a recorded job result", "job_id", job.Id, "error", err)
		} else {
			e.log.InfoContext(ctx, "Job already finished; resending its result", "job_id", job.Id)
		}
		return nil, nil, false
	}
	return executionContext, claimed, true
}

func (e *Executor) claim(ctx context.Context, job *apiclient.Job) (context.Context, *execution, bool) {
	for {
		executionContext, cancel := context.WithCancelCause(ctx)
		claimed := &execution{attempt: job.Attempt, cancel: cancel, done: make(chan struct{})}
		running := e.register(job.Id, claimed)
		if running == nil {
			return executionContext, claimed, true
		}
		cancel(nil)
		if running.attempt >= job.Attempt {
			e.log.DebugContext(ctx, "Job attempt is already running", "job_id", job.Id, "attempt", job.Attempt)
			return nil, nil, false
		}
		e.log.WarnContext(ctx, "A newer job attempt supersedes the running one", "job_id", job.Id,
			"running_attempt", running.attempt, "attempt", job.Attempt)
		running.cancel(fmt.Errorf("%w: attempt %d was superseded by attempt %d", errLeaseLost, running.attempt, job.Attempt))
		select {
		case <-running.done:
		case <-ctx.Done():
			return nil, nil, false
		}
	}
}

func (e *Executor) register(jobID string, claimed *execution) *execution {
	e.inFlightMu.Lock()
	defer e.inFlightMu.Unlock()
	if running, found := e.inFlight[jobID]; found {
		return running
	}
	e.inFlight[jobID] = claimed
	return nil
}

func (e *Executor) release(jobID string, finished *execution) {
	e.inFlightMu.Lock()
	defer e.inFlightMu.Unlock()
	if e.inFlight[jobID] == finished {
		delete(e.inFlight, jobID)
	}
	finished.cancel(nil)
	close(finished.done)
}

func hasValidLease(job *apiclient.Job) bool {
	return job.LeaseToken != nil && *job.LeaseToken != uuid.Nil && job.Attempt >= 1
}

func jobPayload(job *apiclient.Job) string {
	if job.Payload == nil {
		return ""
	}
	return *job.Payload
}
