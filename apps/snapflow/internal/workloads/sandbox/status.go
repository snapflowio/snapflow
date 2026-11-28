// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package sandbox

import (
	"strings"
	"time"

	"github.com/snapflowio/microvm-go/restartpolicy"
	microvmtypes "github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/snapflow/internal/foundation/state"
	"github.com/snapflowio/snapflow/internal/workloads/workload"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"google.golang.org/protobuf/types/known/timestamppb"
)

const runtimeErrorReason = "the sandbox runtime failed"

type sandboxView struct {
	sandboxID  string
	desired    *machinev1alpha1.SandboxDesiredState
	record     *state.SandboxConvergence
	runtime    *microvmtypes.RuntimeObservation
	converging bool
	inFlight   inFlight
}

func runtimeStates() map[microvmtypes.RuntimeState]machinev1alpha1.SandboxRuntimeState {
	return map[microvmtypes.RuntimeState]machinev1alpha1.SandboxRuntimeState{
		microvmtypes.RuntimeStateCreating:     machinev1alpha1.SandboxRuntimeState_SANDBOX_RUNTIME_STATE_CREATING,
		microvmtypes.RuntimeStateRestoring:    machinev1alpha1.SandboxRuntimeState_SANDBOX_RUNTIME_STATE_CREATING,
		microvmtypes.RuntimeStatePullingImage: machinev1alpha1.SandboxRuntimeState_SANDBOX_RUNTIME_STATE_CREATING,
		microvmtypes.RuntimeStateStarted:      machinev1alpha1.SandboxRuntimeState_SANDBOX_RUNTIME_STATE_STARTED,
		microvmtypes.RuntimeStateStopped:      machinev1alpha1.SandboxRuntimeState_SANDBOX_RUNTIME_STATE_STOPPED,
		microvmtypes.RuntimeStatePaused:       machinev1alpha1.SandboxRuntimeState_SANDBOX_RUNTIME_STATE_PAUSED,
		microvmtypes.RuntimeStateStandby:      machinev1alpha1.SandboxRuntimeState_SANDBOX_RUNTIME_STATE_PAUSED,
		microvmtypes.RuntimeStateError:        machinev1alpha1.SandboxRuntimeState_SANDBOX_RUNTIME_STATE_ERROR,
	}
}

func observedStatus(view sandboxView, observedAt time.Time) (*machinev1alpha1.SandboxObservedStatus, bool) {
	status := &machinev1alpha1.SandboxObservedStatus{
		SandboxId:  view.sandboxID,
		ObservedAt: timestamppb.New(observedAt),
	}
	if view.record != nil {
		status.AssignmentGeneration = view.record.AssignmentGeneration
		status.ObservedSpecGeneration = view.record.ObservedSpecGeneration
		status.Result = view.record.Result
		status.PaymentHeld = view.record.PaymentHeld
		if view.record.DaemonVersion != "" {
			status.DaemonVersion = &view.record.DaemonVersion
		}
	} else if view.runtime != nil {
		status.AssignmentGeneration = uint32(view.runtime.Identity.AssignmentGeneration)
	}
	if view.converging && view.inFlight.paymentHeld {
		status.PaymentHeld = true
	}
	state, reason, known := observedState(view)
	if !known || status.AssignmentGeneration == 0 {
		return nil, false
	}
	status.State = state
	if reason != "" {
		status.ErrorReason = &reason
		status.Recoverable = workload.IsRecoverable(reason)
	}
	if state == machinev1alpha1.SandboxRuntimeState_SANDBOX_RUNTIME_STATE_STOPPED && view.runtime != nil {
		reportStop(status, view.runtime.Info)
	}
	return status, true
}

func reportStop(status *machinev1alpha1.SandboxObservedStatus, info microvmtypes.RuntimeInfo) {
	stopReason := strings.TrimSpace(info.ExitMessage)
	if stopReason == "" {
		return
	}
	stopReason = boundedReason(stopReason)
	status.StopReason = &stopReason
	status.Restarting = restartpolicy.Pending(info.RestartPolicy, info.RestartStatus, info.ExitCode)
}

func observedState(view sandboxView) (machinev1alpha1.SandboxRuntimeState, string, bool) {
	switch {
	case view.runtime == nil && view.converging &&
		view.desired.GetLifecycle() != machinev1alpha1.SandboxLifecycle_SANDBOX_LIFECYCLE_DESTROYED:
		return machinev1alpha1.SandboxRuntimeState_SANDBOX_RUNTIME_STATE_CREATING, "", true
	case view.record != nil && view.record.FailureReason != "":
		return machinev1alpha1.SandboxRuntimeState_SANDBOX_RUNTIME_STATE_ERROR, view.record.FailureReason, true
	case view.runtime != nil:
		return hostedState(view.runtime)
	case view.record == nil:
		return machinev1alpha1.SandboxRuntimeState_SANDBOX_RUNTIME_STATE_UNSPECIFIED, "", false
	case destroyedAt(view.desired, view.record):
		return machinev1alpha1.SandboxRuntimeState_SANDBOX_RUNTIME_STATE_DESTROYED, "", true
	case view.record.Materialized:
		return machinev1alpha1.SandboxRuntimeState_SANDBOX_RUNTIME_STATE_MISSING, "", true
	default:
		return machinev1alpha1.SandboxRuntimeState_SANDBOX_RUNTIME_STATE_UNSPECIFIED, "", false
	}
}

func hostedState(runtime *microvmtypes.RuntimeObservation) (machinev1alpha1.SandboxRuntimeState, string, bool) {
	state, known := runtimeStates()[runtime.Info.State]
	if !known || !runtime.InspectionComplete {
		return machinev1alpha1.SandboxRuntimeState_SANDBOX_RUNTIME_STATE_UNSPECIFIED, "", false
	}
	if state != machinev1alpha1.SandboxRuntimeState_SANDBOX_RUNTIME_STATE_ERROR {
		return state, "", true
	}
	reason := strings.TrimSpace(runtime.Info.ExitMessage)
	if reason == "" {
		reason = runtimeErrorReason
	}
	return state, boundedReason(reason), true
}

func destroyedAt(desired *machinev1alpha1.SandboxDesiredState, record *state.SandboxConvergence) bool {
	return desired.GetLifecycle() == machinev1alpha1.SandboxLifecycle_SANDBOX_LIFECYCLE_DESTROYED &&
		record.ObservedSpecGeneration >= desired.GetSpecGeneration()
}
