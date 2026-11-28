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
	"path/filepath"
	"time"

	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/internal/jailidentity"
	"github.com/snapflowio/microvm-go/internal/state"
)

func (b *Backend) pauseVM(ctx context.Context, metadata state.InstanceMetadata) error {
	backend, err := b.hypervisorBackend(metadata.Hypervisor)
	if err != nil {
		return err
	}
	return backend.Pause(ctx, metadata.SocketPath)
}

func (b *Backend) resumeVM(ctx context.Context, metadata state.InstanceMetadata) error {
	backend, err := b.hypervisorBackend(metadata.Hypervisor)
	if err != nil {
		return err
	}
	return backend.Resume(ctx, metadata.SocketPath)
}

func (b *Backend) vmIsPaused(ctx context.Context, metadata state.InstanceMetadata) (bool, error) {
	backend, err := b.hypervisorBackend(metadata.Hypervisor)
	if err != nil {
		return false, err
	}
	info, err := backend.Info(ctx, metadata.SocketPath)
	if err != nil {
		return false, err
	}
	switch info.State {
	case hypervisor.VMStatePaused:
		return true, nil
	case hypervisor.VMStateRunning:
		return false, nil
	default:
		return false, fmt.Errorf("unexpected %s VM state %q", metadata.Hypervisor, info.State)
	}
}

func (b *Backend) snapshotVM(
	ctx context.Context,
	metadata *state.InstanceMetadata,
	base *state.MemoryDiffBase,
	path string,
	retainBase bool,
) (returnErr error) {
	backend, err := b.snapshotBackend(metadata.Hypervisor)
	if err != nil {
		return err
	}
	startedAt := time.Now()
	memoryPath := filepath.Join(path, backend.Capabilities().DiffSnapshotMemory)
	plan := seedMemorySnapshot(b.planMemorySnapshot(ctx, *metadata, backend, base), memoryPath)
	seededAt := time.Now()
	if err := b.prepareSnapshot(metadata.ID, path); err != nil {
		return err
	}
	restoreLimits, err := hypervisor.LiftSnapshotWriteLimits(ctx, hypervisor.VM{
		ID:    metadata.ID,
		VCPUs: int(maxInt64(1, metadata.CPUQuota)),
		Jail:  hypervisor.JailPaths{Root: b.paths.InstanceJailRoot(metadata.ID)},
	})
	if err != nil {
		return fmt.Errorf("lift VMM disk write limits for the snapshot: %w", err)
	}
	defer func() {
		if restoreErr := restoreLimits(context.WithoutCancel(ctx)); restoreErr != nil {
			returnErr = errors.Join(returnErr, fmt.Errorf("restore VMM disk write limits after the snapshot: %w", restoreErr))
		}
	}()
	if err := backend.Snapshot(ctx, hypervisor.SnapshotRequest{SocketPath: metadata.SocketPath, Destination: path, Kind: plan.kind}); err != nil {
		return err
	}
	writtenAt := time.Now()
	if retainBase {
		if err := b.retainMemorySnapshot(metadata, plan, memoryPath); err != nil {
			slog.WarnContext(ctx, "could not retain the snapshot memory as the next diff base; the next snapshot will be full",
				"instance_id", metadata.ID, "error", errors.Join(err, b.discardRetainedMemoryBase(metadata.ID)))
		}
	}
	logMemorySnapshot(ctx, *metadata, plan, startedAt, seededAt, writtenAt)
	return nil
}

func logMemorySnapshot(ctx context.Context, metadata state.InstanceMetadata, plan memorySnapshotPlan, startedAt, seededAt, writtenAt time.Time) {
	attributes := []any{
		"instance_id", metadata.ID,
		"hypervisor", metadata.Hypervisor,
		"snapshot_type", plan.kind,
		"diff_base", plan.diffSource(),
		"next_diff_base", metadata.MemoryDiffBase.SourceOrNone(),
		"total_ms", time.Since(startedAt).Milliseconds(),
		"seed_ms", seededAt.Sub(startedAt).Milliseconds(),
		"write_ms", writtenAt.Sub(seededAt).Milliseconds(),
		"retain_ms", time.Since(writtenAt).Milliseconds(),
	}
	if plan.fallback != nil && plan.base != nil {
		attributes = append(attributes, "full_reason", plan.fallback.Error())
	}
	slog.InfoContext(ctx, "microVM snapshot written", attributes...)
}

func (b *Backend) restoreVM(ctx context.Context, spec hypervisor.VM, snapshotPath string) (hypervisor.Process, error) {
	backend, err := b.snapshotBackend(spec.Hypervisor)
	if err != nil {
		return hypervisor.Process{}, err
	}
	release, err := b.acquireRestoreSlot(ctx, spec.Hypervisor)
	if err != nil {
		return hypervisor.Process{}, fmt.Errorf("wait for %s restore capacity: %w", spec.Hypervisor, err)
	}
	defer release()
	if err := b.prepareRestoreSockets(ctx, spec); err != nil {
		return hypervisor.Process{}, err
	}
	process, err := backend.Restore(ctx, spec, snapshotPath)
	if err != nil {
		return hypervisor.Process{}, newRestoreFailure(classifyRestoreLaunchFailure(err), err)
	}
	return process, nil
}

func prepareSnapshotDirectory(instanceID, path string) error {
	if err := os.MkdirAll(path, instanceVMMDirectoryMode); err != nil {
		return fmt.Errorf("create snapshot directory: %w", err)
	}
	if err := jailidentity.GrantInstanceTree(instanceID, path); err != nil {
		return fmt.Errorf("give the VMM its snapshot directory: %w", err)
	}
	return nil
}
