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
	"fmt"

	microvmtypes "github.com/snapflowio/microvm-go/types"
	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	"github.com/snapflowio/snapflow/internal/workload"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const (
	operationSnapshot    = "snapshot"
	operationMaterialize = "materialize"
	operationAdopt       = "adopt"
	operationRecover     = "recover"
	operationStart       = "start"
	operationResume      = "resume"
	operationReady       = "ready"
	operationStop        = "stop"
	operationPause       = "pause"
	operationResize      = "resize"
	operationNetwork     = "network"
	operationDestroy     = "destroy"
)

func settledStates() map[microvmtypes.RuntimeState]bool {
	return map[microvmtypes.RuntimeState]bool{
		microvmtypes.RuntimeStateStarted: true,
		microvmtypes.RuntimeStateStopped: true,
		microvmtypes.RuntimeStatePaused:  true,
		microvmtypes.RuntimeStateStandby: true,
		microvmtypes.RuntimeStateError:   true,
	}
}

func suspended(current microvmtypes.RuntimeState) bool {
	return current == microvmtypes.RuntimeStatePaused || current == microvmtypes.RuntimeStateStandby
}

func (run *run) act(ctx context.Context, observation *microvmtypes.RuntimeObservation) error {
	if run.desired.GetLifecycle() == machinev1alpha1.SandboxLifecycle_SANDBOX_LIFECYCLE_DESTROYED {
		return run.destroy(ctx, observation != nil)
	}
	if observation == nil {
		return run.materialize(ctx)
	}
	current := observation.Info.State
	if !settledStates()[current] {
		return fmt.Errorf("%w: the sandbox runtime is %s", errRetry, current)
	}
	if err := run.adopt(ctx); err != nil {
		return err
	}
	return run.reconcile(ctx, observation.Info)
}

func (run *run) materialize(ctx context.Context) error {
	if run.record.Materialized && run.record.AssignmentGeneration == run.assignment.Generation {
		return runtimeMissingError{}
	}
	secrets, err := run.secrets(ctx)
	if err != nil {
		return err
	}
	defer discardSecrets(secrets)
	release, err := run.ensureSnapshot(ctx)
	if err != nil {
		return err
	}
	defer release()
	lifecycle := run.desired.GetLifecycle()
	start := lifecycle != machinev1alpha1.SandboxLifecycle_SANDBOX_LIFECYCLE_STOPPED && !run.held
	var started sandboxruntime.StartResult
	if err := run.step(operationMaterialize, func() error {
		var materializeErr error
		started, materializeErr = run.converger.runtime.Materialize(ctx, sandboxruntime.MaterializeRequest{
			Assignment: run.assignment, Spec: run.desired.GetSpec(), Secrets: secrets, Start: start,
		})
		return materializeErr
	}); err != nil {
		return err
	}
	run.record.AssignmentGeneration = run.assignment.Generation
	run.record.Materialized = true
	if started.DaemonVersion != "" {
		run.record.DaemonVersion = started.DaemonVersion
	}
	if start && lifecycle == machinev1alpha1.SandboxLifecycle_SANDBOX_LIFECYCLE_PAUSED {
		if err := run.step(operationPause, func() error { return run.converger.runtime.Pause(ctx, run.assignment) }); err != nil {
			return err
		}
	}
	run.sample()
	return nil
}

func (run *run) adopt(ctx context.Context) error {
	if run.record.Materialized && run.record.AssignmentGeneration == run.assignment.Generation {
		return nil
	}
	if err := run.step(operationAdopt, func() error { return run.converger.runtime.Adopt(ctx, run.assignment) }); err != nil {
		if isStaleAssignment(err) {
			return fmt.Errorf("%w: %w", errSuperseded, err)
		}
		return err
	}
	run.record.AssignmentGeneration = run.assignment.Generation
	run.record.Materialized = true
	return nil
}

type pendingSpec struct {
	resize  bool
	network bool
}

func (run *run) reconcile(ctx context.Context, info microvmtypes.RuntimeInfo) error {
	current := info.State
	if recovery := run.desired.GetDirectives().GetRecovery(); recovery != nil {
		if err := run.step(operationRecover, func() error {
			return run.converger.runtime.Recover(ctx, run.assignment, recovery, run.desired.GetSpec())
		}); err != nil {
			return err
		}
		current = microvmtypes.RuntimeStateStopped
	}
	pending := pendingSpec{
		resize:  resourcesDiffer(info, run.desired.GetSpec().GetResources()),
		network: run.record.SpecDigest != run.desired.GetSpecDigest(),
	}
	switch run.desired.GetLifecycle() {
	case machinev1alpha1.SandboxLifecycle_SANDBOX_LIFECYCLE_STOPPED:
		return run.stop(ctx, current, pending)
	case machinev1alpha1.SandboxLifecycle_SANDBOX_LIFECYCLE_PAUSED:
		return run.pause(ctx, current)
	default:
		if run.held {
			return run.hold(ctx, current, pending)
		}
		return run.start(ctx, current, pending)
	}
}

// hold pauses a sandbox the desired state wants started while its customer
// is not paying. A runtime that is already stopped or paused is left as it
// is; only the spec changes a non-running runtime accepts are applied.
func (run *run) hold(ctx context.Context, current microvmtypes.RuntimeState, pending pendingSpec) error {
	if current == microvmtypes.RuntimeStateStarted {
		if err := run.pause(ctx, current); err != nil {
			return err
		}
		current = microvmtypes.RuntimeStatePaused
	}
	if suspended(current) {
		pending.resize = false
	}
	return run.applySpec(ctx, pending)
}

func resourcesDiffer(info microvmtypes.RuntimeInfo, resources *machinev1alpha1.SandboxResources) bool {
	return info.CPUVCPUs != int64(resources.GetCpuQuota()) ||
		info.MemoryGiB != int64(resources.GetMemoryQuota()) ||
		info.StorageGiB < int64(resources.GetStorageQuota())
}

func (run *run) applySpec(ctx context.Context, pending pendingSpec) error {
	runtime := run.converger.runtime
	if pending.resize {
		if err := run.step(operationResize, func() error {
			return runtime.Resize(ctx, run.assignment, run.desired.GetSpec().GetResources())
		}); err != nil {
			return err
		}
	}
	if !pending.network {
		return nil
	}
	return run.step(operationNetwork, func() error {
		return runtime.UpdateNetwork(ctx, run.assignment, run.desired.GetSpec().GetNetwork())
	})
}

func (run *run) stop(ctx context.Context, current microvmtypes.RuntimeState, pending pendingSpec) error {
	if current != microvmtypes.RuntimeStateStopped {
		force := run.desired.GetDirectives().GetForceStop()
		if err := run.step(operationStop, func() error { return run.converger.runtime.Stop(ctx, run.assignment, force) }); err != nil {
			return err
		}
		run.meter(ctx)
	}
	return run.applySpec(ctx, pending)
}

func (run *run) start(ctx context.Context, current microvmtypes.RuntimeState, pending pendingSpec) error {
	runtime := run.converger.runtime
	cold := current != microvmtypes.RuntimeStateStarted && !suspended(current)
	if !cold {
		pending.resize = false
	}
	if err := run.applySpec(ctx, pending); err != nil {
		return err
	}
	var started sandboxruntime.StartResult
	var err error
	switch {
	case current == microvmtypes.RuntimeStateStarted:
		err = run.step(operationReady, func() error {
			version, readyErr := runtime.DaemonVersion(ctx, run.assignment.SandboxID)
			started.DaemonVersion = version
			return readyErr
		})
	case suspended(current):
		err = run.step(operationResume, func() error {
			var resumeErr error
			started, resumeErr = runtime.Resume(ctx, run.assignment)
			return resumeErr
		})
	default:
		started, err = run.boot(ctx)
	}
	if err != nil {
		return err
	}
	if current != microvmtypes.RuntimeStateStarted {
		run.sample()
	}
	run.record.DaemonVersion = started.DaemonVersion
	return nil
}

func (run *run) boot(ctx context.Context) (sandboxruntime.StartResult, error) {
	secrets, err := run.secrets(ctx)
	if err != nil {
		return sandboxruntime.StartResult{}, err
	}
	defer discardSecrets(secrets)
	var started sandboxruntime.StartResult
	err = run.step(operationStart, func() error {
		var startErr error
		started, startErr = run.converger.runtime.Start(ctx, run.assignment, secrets.GetEnv())
		return startErr
	})
	return started, err
}

func (run *run) pause(ctx context.Context, current microvmtypes.RuntimeState) error {
	switch {
	case suspended(current):
		return nil
	case current == microvmtypes.RuntimeStateStarted:
		if err := run.step(operationPause, func() error { return run.converger.runtime.Pause(ctx, run.assignment) }); err != nil {
			return err
		}
		run.meter(ctx)
		return nil
	default:
		return fmt.Errorf("a %s sandbox runtime cannot be paused", current)
	}
}

func (run *run) destroy(ctx context.Context, hosted bool) error {
	if !hosted {
		return nil
	}
	if err := run.adopt(ctx); err != nil {
		return err
	}
	run.meter(ctx)
	return run.step(operationDestroy, func() error { return run.converger.runtime.Destroy(ctx, run.assignment.SandboxID) })
}

func (run *run) meter(ctx context.Context) {
	if run.local != nil {
		return
	}
	run.converger.meter.Flush(ctx, run.assignment)
}

func (run *run) sample() {
	if run.local != nil {
		return
	}
	run.converger.meter.Sample(run.assignment)
}

func (run *run) ensureSnapshot(ctx context.Context) (func(), error) {
	ref := snapshotRef(run.desired.GetSpec())
	if ref == "" {
		return func() {}, nil
	}
	var release func()
	err := run.step(operationSnapshot, func() error {
		var ensureErr error
		release, ensureErr = run.converger.snapshots.Ensure(ctx, ref)
		return ensureErr
	})
	if errors.Is(err, workload.ErrLocalSnapshotNotHeld) {
		return nil, fmt.Errorf("%w: %w", errRetry, err)
	}
	return release, err
}
