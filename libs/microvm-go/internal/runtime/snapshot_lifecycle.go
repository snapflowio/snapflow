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
	"net/http"
	"os"
	"time"

	"github.com/snapflowio/microvm-go/internal/diskusage"
	mvmerrors "github.com/snapflowio/microvm-go/internal/errors"
	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/jail"
	"github.com/snapflowio/microvm-go/types"
)

const (
	snapshotDiskMargin          = 256 << 20
	snapshotDiskResource        = "snapshot_disk"
	vmmExitedDuringSnapshotCode = "MICROVM_VMM_EXITED_DURING_SNAPSHOT"
)

func (b *Backend) Standby(ctx context.Context, instanceID string) error {
	defer b.requestSupportDiskSample()
	return runLifecycleAction(b, instanceID, lifecycle.OperationStandby, func() error {
		guard, err := b.lifecycle.Lock(ctx, instanceID)
		if err != nil {
			return fmt.Errorf("acquire instance lifecycle lock: %w", err)
		}
		defer guard.Release()
		return b.standbyLocked(ctx, instanceID)
	})
}

func (b *Backend) standbyLocked(ctx context.Context, instanceID string) error {
	metadata, err := b.readInstance(instanceID)
	if err != nil {
		return err
	}
	if err := validateRequestedTransition(lifecycle.OperationStandby, metadata.State); err != nil {
		return err
	}
	if metadata.State == types.RuntimeStateStandby {
		return nil
	}
	if err := b.validateStandbySource(ctx, metadata); err != nil {
		return err
	}
	if err := b.preflightSnapshotDisk(metadata); err != nil {
		return err
	}
	reservationResources := activeInstanceResources(metadata)
	reservationResources.DiskGiB += metadata.MemoryQuota
	reservation, err := b.reserveResources(ctx, instanceID, reservationResources)
	if err != nil {
		return err
	}
	defer reservation.Finish()
	base, err := b.pauseForStandby(ctx, &metadata)
	if err != nil {
		return err
	}
	if err := b.snapshotAndStopForStandby(ctx, instanceID, &metadata, base); err != nil {
		return err
	}
	b.releaseStandbyNetwork(ctx, &metadata)
	now := time.Now().UTC()
	metadata.SnapshotFailureCode = ""
	metadata.SnapshotInvalidatedAt = nil
	metadata.PID = 0
	metadata.StoppedAt = &now
	return b.persistRuntimeState(&metadata, types.RuntimeStateStandby)
}

func (b *Backend) validateStandbySource(ctx context.Context, metadata state.InstanceMetadata) error {
	if err := validateMemorySnapshotPolicy(metadata); err != nil {
		return err
	}
	if metadata.GPUQuota > 0 {
		return stateConflict("standby snapshots are not supported for GPU instances", "MICROVM_GPU_STANDBY_UNSUPPORTED")
	}
	if metadata.State != types.RuntimeStateStarted || !b.processRunning(ctx, metadata) {
		return stateConflict("instance must be running before it can enter standby", "MICROVM_STANDBY_REQUIRES_RUNNING_STATE")
	}
	return nil
}

func (b *Backend) pauseForStandby(ctx context.Context, metadata *state.InstanceMetadata) (*state.MemoryDiffBase, error) {
	if err := b.quiesceGuestForSnapshot(ctx, metadata); err != nil {
		return nil, err
	}
	if err := b.pauseVM(ctx, *metadata); err != nil {
		resumeGuestErr := b.resumeGuestAfterSnapshot(context.WithoutCancel(ctx), *metadata)
		return nil, errors.Join(err, wrapOptionalError("resume guest identity after pause failure", resumeGuestErr))
	}
	base, err := b.persistMemorySnapshotPause(metadata)
	if err != nil {
		resumeVMErr := b.resumeVM(context.WithoutCancel(ctx), *metadata)
		resumeGuestErr := b.resumeGuestAfterSnapshot(context.WithoutCancel(ctx), *metadata)
		return nil, errors.Join(
			err,
			wrapOptionalError("resume VM after standby pause persistence failure", resumeVMErr),
			wrapOptionalError("resume guest after standby pause persistence failure", resumeGuestErr),
		)
	}
	return base, nil
}

func (b *Backend) snapshotAndStopForStandby(ctx context.Context, instanceID string, metadata *state.InstanceMetadata, base *state.MemoryDiffBase) error {
	stagedDir, err := b.stageSnapshot(ctx, metadata, base, false)
	if err != nil {
		return err
	}
	if err := b.claimStandbySnapshot(metadata, stagedDir); err != nil {
		resumeErr := b.resumeSnapshotSource(context.WithoutCancel(ctx), metadata)
		return errors.Join(
			err,
			wrapOptionalError("discard the unclaimed standby snapshot", os.RemoveAll(stagedDir)),
			wrapOptionalError("resume instance after standby snapshot claim failure", resumeErr),
		)
	}
	if err := b.discardLatestSnapshot(instanceID); err != nil {
		resumeErr := b.resumeSnapshotSource(context.WithoutCancel(ctx), metadata)
		return errors.Join(
			err,
			wrapOptionalError("discard the unpromoted standby snapshot", os.RemoveAll(stagedDir)),
			wrapOptionalError("resume instance after standby snapshot promotion failure", resumeErr),
		)
	}
	if err := b.stopVM(ctx, metadata); err != nil {
		resumeErr := b.resumeSnapshotSource(context.WithoutCancel(ctx), metadata)
		return errors.Join(
			err,
			wrapOptionalError("discard the unpromoted standby snapshot", os.RemoveAll(stagedDir)),
			wrapOptionalError("resume instance after standby stop failure", resumeErr),
		)
	}
	if err := os.Rename(stagedDir, b.paths.InstanceLatestSnapshot(instanceID)); err != nil {
		return fmt.Errorf("promote the standby snapshot: %w", err)
	}
	return nil
}

func (b *Backend) claimStandbySnapshot(metadata *state.InstanceMetadata, stagedDir string) error {
	if err := claimSnapshotDirectory(metadata, stagedDir); err != nil {
		return err
	}
	if err := b.persistRuntimeState(metadata, metadata.State); err != nil {
		metadata.OwnSnapshot = nil
		return fmt.Errorf("persist the standby snapshot ownership: %w", err)
	}
	return nil
}

func (b *Backend) stageSnapshot(ctx context.Context, metadata *state.InstanceMetadata, base *state.MemoryDiffBase, retainBase bool) (string, error) {
	stagedDir := b.paths.InstanceStagedSnapshot(metadata.ID)
	if err := os.RemoveAll(stagedDir); err != nil {
		resumeErr := b.resumeSnapshotSource(context.WithoutCancel(ctx), metadata)
		return "", errors.Join(fmt.Errorf("clear the staged snapshot: %w", err), wrapOptionalError("resume instance after snapshot cleanup failure", resumeErr))
	}
	oomWatch := b.watchVMMOOM(ctx, *metadata)
	if err := b.snapshotVM(ctx, metadata, base, stagedDir, retainBase); err != nil {
		if !b.processRunning(ctx, *metadata) {
			return "", b.recoverLostSnapshotSource(ctx, metadata, stagedDir, oomWatch, err)
		}
		resumeErr := b.resumeSnapshotSource(context.WithoutCancel(ctx), metadata)
		return "", errors.Join(
			err,
			wrapOptionalError("discard the partial snapshot", os.RemoveAll(stagedDir)),
			wrapOptionalError("resume instance after snapshot failure", resumeErr),
		)
	}
	return stagedDir, nil
}

func (b *Backend) preflightSnapshotDisk(metadata state.InstanceMetadata) error {
	available, err := diskusage.Available(b.paths.InstanceDir(metadata.ID))
	if err != nil {
		return fmt.Errorf("measure free disk for the memory snapshot: %w", err)
	}
	required := uint64(metadata.MemoryQuota*bytesPerGiB) + snapshotDiskMargin
	if available >= required {
		return nil
	}
	return mvmerrors.New(
		http.StatusServiceUnavailable,
		fmt.Sprintf("the memory snapshot needs %d bytes of free disk but %d are available", required, available),
		insufficientCapacityCodePrefix+snapshotDiskResource,
	)
}

func (b *Backend) watchVMMOOM(ctx context.Context, metadata state.InstanceMetadata) jail.OOMWatch {
	watch, err := jail.WatchOOM(b.runningProcess(ctx, metadata).PID)
	if err != nil {
		slog.WarnContext(ctx, "could not watch the VMM memory cgroup during the snapshot", "instance_id", metadata.ID, "error", err)
	}
	return watch
}

func (b *Backend) recoverLostSnapshotSource(
	ctx context.Context,
	metadata *state.InstanceMetadata,
	snapshotDir string,
	oomWatch jail.OOMWatch,
	cause error,
) error {
	reason := lostSnapshotSourceReason(oomWatch)
	discardErr := os.RemoveAll(snapshotDir)
	metadata.ExitMessage = reason
	recovered, recoverErr := b.reconcileExitedProcess(context.WithoutCancel(ctx), *metadata, types.RuntimeStatePaused)
	*metadata = recovered
	return errors.Join(
		mvmerrors.NewWithCause(http.StatusServiceUnavailable, reason+": "+cause.Error(), vmmExitedDuringSnapshotCode, cause),
		wrapOptionalError("discard the partial standby snapshot", discardErr),
		wrapOptionalError("record the stopped instance after its VMM exited", recoverErr),
	)
}

func lostSnapshotSourceReason(oomWatch jail.OOMWatch) string {
	killed, err := oomWatch.Fired()
	switch {
	case err != nil:
		return fmt.Sprintf("the VMM exited while writing the memory snapshot (OOM status unavailable: %v)", err)
	case killed:
		return "the memory cgroup OOM killer ended the VMM while it wrote the memory snapshot"
	default:
		return "the VMM exited while writing the memory snapshot"
	}
}

func (b *Backend) releaseStandbyNetwork(ctx context.Context, metadata *state.InstanceMetadata) {
	if !instanceHasNetwork(*metadata) {
		return
	}
	if err := b.releaseMeteredNetwork(ctx, metadata); err != nil {
		slog.WarnContext(ctx, "could not release standby network allocation", "instance_id", metadata.ID, "error", err)
		return
	}
	clearNetworkIdentity(metadata)
}

func validateMemorySnapshotPolicy(metadata state.InstanceMetadata) error {
	if !metadata.RequiresSecretEnv {
		return nil
	}
	return stateConflict(
		"live memory snapshots are unavailable for instances with managed secrets; stop the instance before creating a snapshot",
		"MICROVM_SECRET_MEMORY_SNAPSHOT_UNSUPPORTED",
	)
}

func (b *Backend) readInstance(instanceID string) (state.InstanceMetadata, error) {
	metadata, err := state.ReadInstanceMetadata(b.paths, instanceID)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return state.InstanceMetadata{}, mvmerrors.NewNotFound(fmt.Errorf("instance %s", instanceID))
		}
		return state.InstanceMetadata{}, err
	}
	return metadata, nil
}

func stateConflict(message, code string) error {
	return mvmerrors.New(http.StatusConflict, message, code)
}
