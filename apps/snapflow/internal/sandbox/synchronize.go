// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package sandbox

import (
	"context"
	"errors"
	"time"

	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	"github.com/snapflowio/snapflow/internal/state"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

func (manager *Manager) synchronize(ctx context.Context, item work) outcome {
	if manager.local.isHeld(item.sandboxID) || !item.authorized(time.Now()) {
		return outcomeSettled
	}
	if item.desired == nil {
		return manager.remove(ctx, item.sandboxID)
	}
	if manager.activity.isSuppressed(item.sandboxID, item.revision) {
		return outcomeSettled
	}
	record, found := manager.records.get(item.sandboxID)
	if found && !pending(record, item.desired) {
		return outcomeSettled
	}
	target := Target{Desired: item.desired}
	if found {
		target.Record = &record
	}
	manager.activity.begin(item.sandboxID)
	converged, err := manager.converger.Converge(ctx, target)
	manager.activity.end(item.sandboxID)
	switch {
	case err == nil:
		return manager.record(ctx, converged)
	case errors.Is(err, errSuperseded), ctx.Err() != nil:
		manager.log.DebugContext(ctx, "Sandbox convergence did not finish", "sandbox_id", item.sandboxID, "error", err)
		return outcomeSettled
	default:
		manager.log.WarnContext(ctx, "Sandbox convergence will be retried", "sandbox_id", item.sandboxID, "error", err)
		return outcomeRetry
	}
}

func pending(record state.SandboxConvergence, desired *machinev1alpha1.SandboxDesiredState) bool {
	switch {
	case record.AssignmentGeneration > desired.GetAssignmentGeneration():
		return false
	case record.AssignmentGeneration < desired.GetAssignmentGeneration():
		return true
	default:
		return record.ObservedSpecGeneration < desired.GetSpecGeneration()
	}
}

func (manager *Manager) record(ctx context.Context, converged state.SandboxConvergence) outcome {
	if err := manager.records.put(ctx, converged); err != nil {
		manager.log.ErrorContext(ctx, "Failed to record sandbox convergence", "sandbox_id", converged.SandboxID, "error", err)
		return outcomeRetry
	}
	logArguments := []any{
		"sandbox_id", converged.SandboxID,
		"assignment_generation", converged.AssignmentGeneration,
		"spec_generation", converged.ObservedSpecGeneration,
	}
	if converged.FailureReason != "" {
		manager.log.WarnContext(ctx, "Sandbox convergence failed", append(logArguments, "reason", converged.FailureReason)...)
	} else {
		manager.log.InfoContext(ctx, "Sandbox converged", logArguments...)
	}
	manager.reporter.request()
	return outcomeSettled
}

func (manager *Manager) remove(ctx context.Context, sandboxID string) outcome {
	if record, found := manager.records.get(sandboxID); found {
		manager.meter.Flush(ctx, sandboxruntime.Assignment{SandboxID: sandboxID, Generation: record.AssignmentGeneration})
	}
	if err := manager.runtime.Destroy(ctx, sandboxID); err != nil {
		if ctx.Err() == nil {
			manager.log.WarnContext(ctx, "Failed to remove an unlisted sandbox runtime", "sandbox_id", sandboxID, "error", err)
		}
		return outcomeRetry
	}
	if err := manager.records.remove(ctx, sandboxID); err != nil {
		manager.log.ErrorContext(ctx, "Failed to forget an unlisted sandbox", "sandbox_id", sandboxID, "error", err)
		return outcomeRetry
	}
	manager.log.InfoContext(ctx, "Removed a sandbox the desired state no longer lists", "sandbox_id", sandboxID)
	manager.reporter.request()
	return outcomeRemoved
}
