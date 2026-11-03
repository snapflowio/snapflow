// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package runtime

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/network"
	"github.com/snapflowio/microvm-go/types"
)

const (
	reconcileInFlightReadinessTimeout = 10 * time.Second
	reconcileQuiescedRecoveryTimeout  = 45 * time.Second
)

type reconcileReport struct {
	Failed map[string]error
}

type reconciledInstances struct {
	allocations map[string]network.Allocation
	policies    []network.PolicyBinding
	instances   map[string]state.InstanceMetadata
	quarantined map[string]struct{}
}

func newReconciledInstances() *reconciledInstances {
	return &reconciledInstances{
		allocations: make(map[string]network.Allocation),
		instances:   make(map[string]state.InstanceMetadata),
		quarantined: make(map[string]struct{}),
	}
}

func (recovered *reconciledInstances) retain(metadata state.InstanceMetadata) error {
	if metadata.State == types.RuntimeStateDestroyed {
		return nil
	}
	recovered.instances[metadata.ID] = metadata
	if !instanceHasNetwork(metadata) {
		return nil
	}
	policy, err := instanceEgressPolicy(metadata)
	if err != nil {
		return fmt.Errorf("restore instance egress policy: %w", err)
	}
	recovered.allocations[metadata.ID] = *metadata.Network
	recovered.policies = append(recovered.policies, instancePolicyBinding(metadata, policy))
	return nil
}

func (b *Backend) reconcile(ctx context.Context) (reconcileReport, error) {
	report := reconcileReport{Failed: make(map[string]error)}
	if err := b.reconcileGPULeaseJournals(ctx); err != nil {
		return report, fmt.Errorf("reconcile dedicated GPU leases: %w", err)
	}
	entries, err := os.ReadDir(b.paths.InstancesDir())
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return report, fmt.Errorf("list instance state for reconciliation: %w", err)
	}
	recovered := newReconciledInstances()
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		if err := ctx.Err(); err != nil {
			return report, err
		}
		startedAt := time.Now()
		instanceErr := b.reconcileEntry(ctx, entry.Name(), recovered)
		if instanceErr != nil {
			report.Failed[entry.Name()] = instanceErr
		}
		b.publishReconcileEvent(entry.Name(), startedAt, instanceErr)
	}
	return report, b.reconcileHostResources(ctx, recovered)
}

func (b *Backend) reconcileHostResources(ctx context.Context, recovered *reconciledInstances) error {
	return errors.Join(
		wrapOptionalError("reconcile instance networks", b.networks.Reconcile(ctx, recovered.allocations)),
		wrapOptionalError("reconcile instance egress policies", b.networks.ReconcileEgressPolicies(ctx, recovered.policies)),
		wrapOptionalError(
			"reconcile instance volumes",
			b.reconcileVolumeAttachments(ctx, recovered.instances, recovered.quarantined),
		),
	)
}

func (b *Backend) publishReconcileEvent(instanceID string, startedAt time.Time, err error) {
	phase := lifecycle.PhaseSucceeded
	if err != nil {
		phase = lifecycle.PhaseFailed
	}
	b.events.Publish(lifecycle.Event{
		InstanceID: instanceID,
		Operation:  lifecycle.OperationReconcile,
		Phase:      phase,
		Timestamp:  time.Now().UTC(),
		Duration:   time.Since(startedAt),
		Err:        err,
	})
}

func (b *Backend) reconcileEntry(ctx context.Context, instanceID string, recovered *reconciledInstances) error {
	metadata, err := state.ReadInstanceMetadata(b.paths, instanceID)
	if errors.Is(err, os.ErrNotExist) {
		return b.removeOrphanInstanceState(instanceID)
	}
	if err != nil {
		recovered.quarantined[instanceID] = struct{}{}
		return fmt.Errorf("read instance metadata: %w", err)
	}
	if isInternalBuilder(metadata) {
		if err := b.reconcileInternalBuilder(ctx, metadata); err != nil {
			return fmt.Errorf("reconcile internal builder: %w", err)
		}
		return nil
	}
	if err := b.removeDiscardedSnapshots(instanceID); err != nil {
		return errors.Join(err, recovered.retain(metadata))
	}
	reconciled, err := b.reconcileInstanceMetadata(ctx, metadata)
	if err != nil {
		return errors.Join(err, recovered.retain(metadata))
	}
	return recovered.retain(reconciled)
}

func (b *Backend) reconcileInternalBuilder(ctx context.Context, metadata state.InstanceMetadata) error {
	if process := b.runningProcess(ctx, metadata); process.Running() {
		if err := hypervisor.Terminate(process, vmmTerminationGracePeriod); err != nil {
			return fmt.Errorf("terminate orphaned builder VMM: %w", err)
		}
	}
	return errors.Join(
		wrapOptionalError("release orphaned builder network", b.releaseNetwork(ctx, metadata)),
		wrapOptionalError("remove orphaned builder state", b.removeInstanceStateDirectories(metadata.ID)),
	)
}

func (b *Backend) reconcileInstanceMetadata(ctx context.Context, metadata state.InstanceMetadata) (state.InstanceMetadata, error) {
	nextState := metadata.State
	process := b.runningProcess(ctx, metadata)
	if process.Running() {
		observeRunning(&metadata.RunningMeter, time.Now().UTC())
		var err error
		if process, nextState, err = b.reconcileLiveProcess(ctx, &metadata, process); err != nil {
			return metadata, err
		}
	}
	if process.Running() {
		metadata.PID = process.PID
		return metadata, b.persistRuntimeState(&metadata, nextState)
	}
	return b.reconcileExitedProcess(ctx, metadata, nextState)
}

func (b *Backend) reconcileLiveProcess(
	ctx context.Context,
	metadata *state.InstanceMetadata,
	process hypervisor.Process,
) (hypervisor.Process, types.RuntimeState, error) {
	nextState := metadata.State
	var err error
	if nextState == types.RuntimeStateCreating || nextState == types.RuntimeStateStarting {
		if process, err = b.reconcileInFlightStartup(ctx, *metadata, process); err != nil || !process.Running() {
			return process, nextState, err
		}
	}
	if metadata.RestoreIdentityPending {
		if err := hypervisor.Terminate(process, vmmTerminationGracePeriod); err != nil {
			return process, nextState, fmt.Errorf("terminate restore with uncommitted guest identity: %w", err)
		}
		metadata.PID = 0
		return hypervisor.Process{}, types.RuntimeStateRestoring, nil
	}
	if metadata.SnapshotIdentityQuiesced {
		if process, err = b.reconcileQuiescedSource(ctx, metadata, process); err != nil || !process.Running() {
			return process, nextState, err
		}
	}
	return settleLiveState(metadata, process, nextState)
}

func (b *Backend) reconcileInFlightStartup(ctx context.Context, metadata state.InstanceMetadata, process hypervisor.Process) (hypervisor.Process, error) {
	if metadata.TemplateSeed {
		slog.WarnContext(ctx, "terminating incomplete runtime template seed", "instance_id", metadata.ID)
		if err := hypervisor.Terminate(process, vmmTerminationGracePeriod); err != nil {
			return process, fmt.Errorf("terminate incomplete runtime template seed: %w", err)
		}
		return hypervisor.Process{}, nil
	}
	readinessCtx, cancel := context.WithTimeout(ctx, reconcileInFlightReadinessTimeout)
	defer cancel()
	readinessErr := b.waitForGuestReady(readinessCtx, metadata)
	if readinessErr == nil {
		readinessErr = b.waitForGuestServicesReady(readinessCtx, metadata)
	}
	if readinessErr == nil {
		readinessErr = b.waitForWorkloadReady(readinessCtx, metadata)
	}
	if readinessErr == nil {
		return process, nil
	}
	slog.WarnContext(ctx, "terminating incomplete runtime startup", "instance_id", metadata.ID, "error", readinessErr)
	if err := hypervisor.Terminate(process, vmmTerminationGracePeriod); err != nil {
		return process, errors.Join(readinessErr, fmt.Errorf("terminate incomplete runtime startup: %w", err))
	}
	return hypervisor.Process{}, nil
}

func (b *Backend) reconcileQuiescedSource(ctx context.Context, metadata *state.InstanceMetadata, process hypervisor.Process) (hypervisor.Process, error) {
	recoverCtx, cancel := context.WithTimeout(ctx, reconcileQuiescedRecoveryTimeout)
	recoverErr := b.recoverQuiescedSnapshotSource(recoverCtx, metadata)
	cancel()
	if recoverErr == nil {
		return b.runningProcess(ctx, *metadata), nil
	}
	slog.WarnContext(
		ctx, "failed to recover quiesced snapshot source; stopping inconsistent VM",
		"instance_id", metadata.ID,
		"error", recoverErr,
	)
	if err := hypervisor.Terminate(process, vmmTerminationGracePeriod); err != nil {
		return process, errors.Join(recoverErr, fmt.Errorf("terminate unrecoverable snapshot source: %w", err))
	}
	return hypervisor.Process{}, nil
}

func settleLiveState(metadata *state.InstanceMetadata, process hypervisor.Process, nextState types.RuntimeState) (hypervisor.Process, types.RuntimeState, error) {
	switch nextState {
	case types.RuntimeStateCreating, types.RuntimeStateStarting, types.RuntimeStateRestoring:
		metadata.StartedAt = timePointer(time.Now().UTC())
		metadata.StoppedAt = nil
		return process, types.RuntimeStateStarted, nil
	case types.RuntimeStateStarted, types.RuntimeStatePaused:
		return process, nextState, nil
	default:
		if err := hypervisor.Terminate(process, vmmTerminationGracePeriod); err != nil {
			return process, nextState, fmt.Errorf("terminate VMM inconsistent with persisted state %s: %w", nextState, err)
		}
		return hypervisor.Process{}, nextState, nil
	}
}

func (b *Backend) reconcileExitedProcess(
	ctx context.Context,
	metadata state.InstanceMetadata,
	nextState types.RuntimeState,
) (state.InstanceMetadata, error) {
	if err := b.cleanupExitedRuntimeArtifacts(ctx, metadata); err != nil {
		return metadata, err
	}
	metadata.PID = 0
	if err := b.releaseGPUDevices(ctx, &metadata); err != nil {
		return metadata, fmt.Errorf("release stale instance GPU lease: %w", err)
	}
	now := time.Now().UTC()
	metadata.StoppedAt = &now
	if metadata.RunningMeter.Since != nil {
		meterRunningTransition(&metadata.RunningMeter, types.RuntimeStateStopped, lastObservedRunning(metadata.RunningMeter))
	}
	snapshotAvailable := b.latestSnapshotAvailable(metadata.ID)
	if metadata.SnapshotIdentityQuiesced && !metadata.RestoreIdentityPending {
		if snapshotAvailable {
			nextState = types.RuntimeStateStandby
		} else {
			metadata.SnapshotIdentityQuiesced = false
			metadata.SnapshotControlAuthToken = ""
		}
	}
	switch nextState {
	case types.RuntimeStateRestoring:
		nextState = types.RuntimeStateError
		if snapshotAvailable {
			nextState = types.RuntimeStateStandby
		}
	case types.RuntimeStateCreating, types.RuntimeStateStarting, types.RuntimeStatePullingImage:
		nextState = types.RuntimeStateError
	case types.RuntimeStateStarted, types.RuntimeStatePaused, types.RuntimeStateStopping, types.RuntimeStateResizing:
		nextState = types.RuntimeStateStopped
	case types.RuntimeStateDestroying, types.RuntimeStateDestroyed:
		return metadata, b.removeDestroyedInstance(ctx, metadata)
	}
	return metadata, b.persistRuntimeState(&metadata, nextState)
}

func (b *Backend) latestSnapshotAvailable(instanceID string) bool {
	info, err := os.Stat(b.paths.InstanceLatestSnapshot(instanceID))
	return err == nil && info.IsDir()
}

func (b *Backend) removeDestroyedInstance(ctx context.Context, metadata state.InstanceMetadata) error {
	if err := b.releaseNetwork(ctx, metadata); err != nil {
		return err
	}
	if err := b.detachVolumeAttachments(ctx, metadata); err != nil {
		return err
	}
	return b.removeInstanceStateDirectories(metadata.ID)
}

func removeStaleRuntimeArtifact(path string) error {
	if path == "" {
		return nil
	}
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}

func (b *Backend) removeOrphanInstanceState(instanceID string) error {
	if process, err := hypervisor.ReadPID(b.paths.InstancePID(instanceID)); err == nil {
		if err := hypervisor.Terminate(process, vmmTerminationGracePeriod); err != nil {
			return fmt.Errorf("terminate orphan VMM: %w", err)
		}
	}
	if err := b.removeInstanceStateDirectories(instanceID); err != nil {
		return fmt.Errorf("remove orphan instance directory: %w", err)
	}
	return nil
}

func timePointer(value time.Time) *time.Time {
	return &value
}
