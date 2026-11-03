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
	mvmerrors "github.com/snapflowio/microvm-go/internal/errors"
	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/restartpolicy"
	"github.com/snapflowio/microvm-go/types"
)

func (b *Backend) Destroy(ctx context.Context, instanceID string) error {
	return runLifecycleAction(b, instanceID, lifecycle.OperationDestroy, func() error {
		guard, err := b.lockInstanceMutation(ctx, instanceID)
		if err != nil {
			return fmt.Errorf("acquire instance lifecycle lock: %w", err)
		}
		defer guard.Release()
		return b.destroyLocked(ctx, instanceID)
	})
}

func (b *Backend) destroyLocked(ctx context.Context, instanceID string) error {
	metadata, err := state.ReadInstanceMetadata(b.paths, instanceID)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	if errors.Is(err, os.ErrNotExist) {
		if err := b.removeInstanceStateDirectories(instanceID); err != nil {
			return fmt.Errorf("remove orphaned instance state: %w", err)
		}
		return nil
	}
	if err := validateRequestedTransition(lifecycle.OperationDestroy, metadata.State); err != nil {
		return err
	}
	if err := b.detachLinkedPeer(ctx, &metadata); err != nil {
		return err
	}
	if err := b.persistRuntimeState(&metadata, types.RuntimeStateDestroying); err != nil {
		return fmt.Errorf("persist destroying instance state: %w", err)
	}
	stopErr := b.stopVM(ctx, &metadata)
	if stopErr != nil && b.processRunning(ctx, metadata) {
		return fmt.Errorf("stop instance VM before destroy: %w", stopErr)
	}
	cleanupErr := errors.Join(
		wrapOptionalError("stop instance VM", stopErr),
		wrapOptionalError("release instance GPU lease", b.releaseGPUDevices(ctx, &metadata)),
		wrapOptionalError("release instance network", b.releaseNetwork(ctx, metadata)),
		wrapOptionalError("detach instance volumes", b.detachVolumeAttachments(ctx, metadata)),
	)
	if cleanupErr != nil {
		return cleanupErr
	}
	now := time.Now().UTC()
	metadata.StoppedAt = &now
	if err := b.persistRuntimeState(&metadata, types.RuntimeStateDestroyed); err != nil {
		return fmt.Errorf("persist destroyed instance state: %w", err)
	}
	if err := b.removeInstanceStateDirectories(instanceID); err != nil {
		return fmt.Errorf("remove instance state: %w", err)
	}
	return nil
}

func (b *Backend) Start(ctx context.Context, instanceID string, request types.StartOptions) error {
	return runLifecycleAction(b, instanceID, lifecycle.OperationStart, func() error {
		guard, err := b.lockInstanceMutation(ctx, instanceID)
		if err != nil {
			return fmt.Errorf("acquire instance lifecycle lock: %w", err)
		}
		defer guard.Release()
		return b.startExplicitLocked(ctx, instanceID, request)
	})
}

func (b *Backend) startExplicitLocked(ctx context.Context, instanceID string, request types.StartOptions) error {
	metadata, err := b.readInstance(instanceID)
	if err != nil {
		return err
	}
	if err := b.admitAssignmentGeneration(&metadata, request.AssignmentGeneration); err != nil {
		return err
	}
	if metadata.RestartStatus != (restartpolicy.Status{}) {
		metadata.RestartStatus = restartpolicy.Status{}
		if err := b.writeInstance(metadata); err != nil {
			return fmt.Errorf("clear restart status for explicit start: %w", err)
		}
	}
	return b.startLocked(ctx, instanceID, request)
}

func (b *Backend) startLocked(ctx context.Context, instanceID string, request types.StartOptions) (returnErr error) {
	startupStartedAt := time.Now()
	metadata, err := b.readStartableInstance(instanceID)
	if err != nil {
		return err
	}
	if handled, err := b.startFromCurrentState(ctx, instanceID, metadata, request); handled {
		return err
	}
	if err := b.ensurePersistedPlatformBundles(ctx, metadata); err != nil {
		return err
	}
	if err := b.validateResourceShape(activeInstanceResources(metadata)); err != nil {
		return err
	}
	reservation, err := b.reserveResources(ctx, instanceID, activeInstanceResources(metadata))
	if err != nil {
		return err
	}
	defer reservation.Finish()
	if err := b.validateBootPrerequisites(); err != nil {
		return err
	}
	if metadata.GPUQuota > 0 {
		defer b.finishGPUAssignment(metadata.ID)
	}
	transaction := lifecycle.NewTransaction()
	defer func() {
		if returnErr != nil {
			returnErr = errors.Join(returnErr, transaction.Rollback(ctx))
		}
	}()
	if err := b.prepareStart(ctx, transaction, &metadata); err != nil {
		return err
	}
	bootStartedAt := time.Now()
	boot := &phaseTimer{}
	if err := b.bootInstance(ctx, transaction, &metadata, bootAssets{}, request.SecretEnv, boot); err != nil {
		return errors.Join(err, b.persistFailedStart(ctx, transaction, &metadata))
	}
	transaction.Commit()
	attributes := []any{
		"instance_id", metadata.ID,
		"hypervisor", metadata.Hypervisor,
		"total_ms", time.Since(startupStartedAt).Milliseconds(),
		"prepare_ms", bootStartedAt.Sub(startupStartedAt).Milliseconds(),
	}
	slog.InfoContext(ctx, "microVM instance ready", append(attributes, boot.attributes...)...)
	return nil
}

func (b *Backend) readStartableInstance(instanceID string) (state.InstanceMetadata, error) {
	metadata, err := state.ReadInstanceMetadata(b.paths, instanceID)
	if errors.Is(err, os.ErrNotExist) {
		return state.InstanceMetadata{}, mvmerrors.NewNotFound(fmt.Errorf("instance %s", instanceID))
	}
	if err != nil {
		return state.InstanceMetadata{}, err
	}
	if err := validateRequestedTransition(lifecycle.OperationStart, metadata.State); err != nil {
		return state.InstanceMetadata{}, err
	}
	return metadata, nil
}

func (b *Backend) startFromCurrentState(ctx context.Context, instanceID string, metadata state.InstanceMetadata, request types.StartOptions) (bool, error) {
	switch metadata.State {
	case types.RuntimeStateStarted:
		if process := b.runningProcess(ctx, metadata); process.Running() {
			return true, b.adoptRunningProcess(&metadata, process)
		}
	case types.RuntimeStatePaused:
		return true, b.resumeLocked(ctx, instanceID)
	case types.RuntimeStateStandby:
		return true, b.restoreLocked(ctx, instanceID, request)
	}
	return false, nil
}

func (b *Backend) adoptRunningProcess(metadata *state.InstanceMetadata, process hypervisor.Process) error {
	if metadata.PID == process.PID {
		return nil
	}
	metadata.PID = process.PID
	if err := b.writeInstance(*metadata); err != nil {
		return fmt.Errorf("persist recovered instance process identity: %w", err)
	}
	return nil
}

func (b *Backend) prepareStart(ctx context.Context, transaction *lifecycle.Transaction, metadata *state.InstanceMetadata) error {
	allocatedNetwork, err := b.attachInstanceNetwork(ctx, metadata)
	if err != nil {
		return fmt.Errorf("attach instance network before start: %w", err)
	}
	if allocatedNetwork {
		if err := transaction.Defer("instance network", func(rollbackCtx context.Context) error {
			return b.detachStartNetwork(rollbackCtx, metadata)
		}); err != nil {
			return err
		}
	}
	record, err := b.instanceImageRecord(*metadata)
	if err != nil {
		return err
	}
	if err := b.writeInstanceConfigDrive(*metadata, record); err != nil {
		return err
	}
	if allocatedNetwork {
		if err := b.writeInstance(*metadata); err != nil {
			return fmt.Errorf("persist instance network before start: %w", err)
		}
	}
	if len(metadata.GPUAssignments) > 0 {
		if err := b.releaseGPUDevices(ctx, metadata); err != nil {
			return fmt.Errorf("release stale GPU lease before start: %w", err)
		}
	}
	if err := b.assignStartGPUDevices(ctx, transaction, metadata); err != nil {
		return err
	}
	return b.cleanupExitedRuntimeArtifacts(ctx, *metadata)
}

func (b *Backend) assignStartGPUDevices(ctx context.Context, transaction *lifecycle.Transaction, metadata *state.InstanceMetadata) error {
	if metadata.GPUQuota <= 0 {
		return nil
	}
	gpuAssignments, err := b.assignGPUDevices(ctx, *metadata)
	if err != nil {
		return err
	}
	metadata.GPUAssignments = gpuAssignments
	metadata.PCIDevices = gpuPCIPaths(gpuAssignments)
	if err := transaction.Defer("instance GPU lease", func(rollbackCtx context.Context) error {
		return b.releaseGPUDevices(rollbackCtx, metadata)
	}); err != nil {
		return err
	}
	return b.writeInstance(*metadata)
}

func (b *Backend) detachStartNetwork(ctx context.Context, metadata *state.InstanceMetadata) error {
	if err := b.releaseNetwork(ctx, *metadata); err != nil {
		return err
	}
	clearNetworkIdentity(metadata)
	if err := b.writeInstance(*metadata); err != nil {
		return fmt.Errorf("persist released instance network: %w", err)
	}
	return nil
}

func (b *Backend) persistFailedStart(ctx context.Context, transaction *lifecycle.Transaction, metadata *state.InstanceMetadata) error {
	rollbackErr := transaction.Rollback(ctx)
	metadata.PID = 0
	return errors.Join(
		rollbackErr,
		wrapOptionalError("persist failed instance start", b.persistRuntimeState(metadata, types.RuntimeStateError)),
	)
}
