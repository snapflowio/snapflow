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
	"fmt"
	"os"

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

func (b *Backend) snapshotVM(ctx context.Context, metadata state.InstanceMetadata, path string) error {
	backend, err := b.snapshotBackend(metadata.Hypervisor)
	if err != nil {
		return err
	}
	if err := b.prepareSnapshot(metadata.ID, path); err != nil {
		return err
	}
	return backend.Snapshot(ctx, metadata.SocketPath, path)
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

// prepareSnapshotDirectory creates the snapshot destination owned by the
// instance's jail identity: the VMM writes it without root.
func prepareSnapshotDirectory(instanceID, path string) error {
	uid, gid, err := jailidentity.ForInstance(instanceID)
	if err != nil {
		return fmt.Errorf("resolve VMM identity: %w", err)
	}
	if err := os.MkdirAll(path, instanceVMMDirectoryMode); err != nil {
		return fmt.Errorf("create snapshot directory: %w", err)
	}
	if err := os.Chown(path, int(uid), int(gid)); err != nil {
		return fmt.Errorf("give the VMM its snapshot directory: %w", err)
	}
	return nil
}
