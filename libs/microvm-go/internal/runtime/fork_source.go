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
	"os"
	"path/filepath"

	"github.com/snapflowio/microvm-go/internal/forkvm"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/types"
)

func (b *Backend) loadForkSource(instanceID string) (forkSource, error) {
	metadata, err := b.readInstance(instanceID)
	return forkSource{metadata: metadata}, err
}

func (b *Backend) materializeForkSourceWithOptions(source forkSource, forkID string, options forkOptions) error {
	targetDir := b.paths.InstanceDir(forkID)
	copyOptions := forkvm.CopyOptions{
		SkipRelativePaths: map[string]struct{}{
			filepath.Base(b.paths.InstanceMetadata(source.metadata.ID)):   {},
			filepath.Base(b.paths.InstanceMemoryBase(source.metadata.ID)): {},
		},
	}
	if options.shareSnapshotMemory {
		copyOptions.HardlinkRelativePaths = map[string]struct{}{templateSnapshotMemoryRelativePath(): {}}
	}
	if source.metadata.State == types.RuntimeStateStarted {
		copyOptions.SkipRelativePaths[filepath.Base(b.paths.InstanceSnapshotsDir(source.metadata.ID))] = struct{}{}
	}
	if err := forkvm.CopyDirWithOptions(b.paths.InstanceDir(source.metadata.ID), targetDir, copyOptions); err != nil {
		return err
	}
	if source.metadata.State != types.RuntimeStateStarted {
		return nil
	}
	return b.claimStagedForkSnapshot(source.metadata.ID, forkID)
}

func (b *Backend) claimStagedForkSnapshot(sourceID, targetID string) error {
	if err := os.MkdirAll(b.paths.InstanceSnapshotsDir(targetID), instanceVMMDirectoryMode); err != nil {
		return fmt.Errorf("create fork snapshot directory: %w", err)
	}
	if err := os.Rename(b.paths.InstanceStagedSnapshot(sourceID), b.paths.InstanceLatestSnapshot(targetID)); err != nil {
		return fmt.Errorf("move the source snapshot into the fork: %w", err)
	}
	return nil
}

func validateForkSource(source state.InstanceMetadata) error {
	if len(source.VolumeAttachments) > 0 {
		return stateConflict(
			"instances with persistent volumes cannot be forked; snapshot or clone each volume explicitly",
			"MICROVM_VOLUME_FORK_UNSUPPORTED",
		)
	}
	switch source.State {
	case types.RuntimeStateStarted, types.RuntimeStateStopped, types.RuntimeStateStandby, types.RuntimeStateError:
		return nil
	case types.RuntimeStatePaused:
		return stateConflict(
			"paused instances must be resumed before forking so guest identity can be quiesced",
			"MICROVM_FORK_REQUIRES_RESUMED_STATE",
		)
	default:
		return stateConflict(
			"instance must be stopped, in standby, or in an error state before it can be forked",
			"MICROVM_FORK_INVALID_STATE",
		)
	}
}

func (b *Backend) prepareFastForkSource(ctx context.Context, source state.InstanceMetadata) (bool, func() error, error) {
	switch source.State {
	case types.RuntimeStateStarted:
		return b.snapshotRunningForkSource(ctx, source)
	case types.RuntimeStateStandby:
		ready, err := b.standbyForkSnapshotReady(source)
		return ready, nil, err
	default:
		return false, nil, nil
	}
}

func (b *Backend) snapshotRunningForkSource(ctx context.Context, source state.InstanceMetadata) (bool, func() error, error) {
	if source.GPUQuota > 0 {
		return false, nil, stateConflict("live GPU instance forks are not supported", "MICROVM_GPU_FORK_UNSUPPORTED")
	}
	if err := b.quiesceGuestForSnapshot(ctx, &source); err != nil {
		return false, nil, err
	}
	if err := b.pauseVM(ctx, source); err != nil {
		resumeErr := b.resumeGuestAfterSnapshot(context.WithoutCancel(ctx), source)
		return false, nil, errors.Join(err, wrapOptionalError("resume guest identity after pause failure", resumeErr))
	}
	base, err := b.persistMemorySnapshotPause(&source)
	if err != nil {
		resumeVMErr := b.resumeVM(context.WithoutCancel(ctx), source)
		resumeGuestErr := b.resumeGuestAfterSnapshot(context.WithoutCancel(ctx), source)
		return false, nil, errors.Join(
			err,
			wrapOptionalError("resume VM after fork pause persistence failure", resumeVMErr),
			wrapOptionalError("resume guest after fork pause persistence failure", resumeGuestErr),
		)
	}
	stagedDir, err := b.stageSnapshot(ctx, &source, base, true)
	if err != nil {
		return false, nil, fmt.Errorf("snapshot running fork source: %w", err)
	}
	return true, func() error {
		resumeErr := b.resumeSnapshotSource(context.WithoutCancel(ctx), &source)
		removeErr := os.RemoveAll(stagedDir)
		return errors.Join(
			wrapOptionalError("resume source after fork", resumeErr),
			wrapOptionalError("remove unclaimed source fork snapshot", removeErr),
		)
	}, nil
}

func (b *Backend) standbyForkSnapshotReady(source state.InstanceMetadata) (bool, error) {
	if !source.SnapshotIdentityQuiesced || !b.ownsLatestSnapshot(source) {
		return false, nil
	}
	info, err := os.Stat(b.paths.InstanceLatestSnapshot(source.ID))
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("inspect standby fork snapshot: %w", err)
	}
	return info.IsDir(), nil
}

func (b *Backend) finalizeForkPaths(forked *state.InstanceMetadata) {
	forked.OverlayDisk = b.paths.InstanceOverlay(forked.ID)
	forked.ConfigDisk = b.paths.InstanceConfigDisk(forked.ID)
	forked.SocketPath, forked.VsockSocket = b.runtimeSocketPaths(forked.ID, forked.Hypervisor)
}
