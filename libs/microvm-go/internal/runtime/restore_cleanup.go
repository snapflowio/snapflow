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
	"strings"

	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/internal/state"
)

func (b *Backend) prepareRestoreSockets(ctx context.Context, spec hypervisor.VM) error {
	if process, err := hypervisor.ReadPID(b.paths.InstancePID(spec.ID)); err == nil {
		return newRestoreFailure(
			restoreFailureExternalResourceBusy,
			fmt.Errorf("runtime %s still has VMM process %d", spec.ID, process.PID),
		)
	}
	if process, err := hypervisor.ResolveProcess(spec.SocketPath); err == nil && process.Running() {
		return newRestoreFailure(
			restoreFailureExternalResourceBusy,
			fmt.Errorf("runtime %s API socket is still assigned to VMM process %d", spec.ID, process.PID),
		)
	}
	for _, socket := range []struct {
		name string
		path string
	}{
		{name: "API", path: spec.SocketPath},
		{name: "vsock", path: spec.VsockSocket},
	} {
		if err := removeVerifiedStaleSocket(ctx, socket.path); err != nil {
			return fmt.Errorf("prepare %s %s socket: %w", spec.Hypervisor, socket.name, err)
		}
	}
	pidPath := b.paths.InstancePID(spec.ID)
	if err := os.Remove(pidPath); err != nil && !errors.Is(err, os.ErrNotExist) {
		return newRestoreFailure(
			restoreFailureProcessCleanupIncomplete,
			fmt.Errorf("remove stale VMM PID record: %w", err),
		)
	}
	return nil
}

func removeVerifiedStaleSocket(ctx context.Context, path string) error {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil
	}
	if _, err := os.Lstat(path); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return newRestoreFailure(restoreFailureProcessCleanupIncomplete, err)
	}
	if process, err := hypervisor.ResolveProcess(path); err == nil && process.Running() {
		return newRestoreFailure(
			restoreFailureExternalResourceBusy,
			fmt.Errorf("socket %s is owned by process %d", path, process.PID),
		)
	}
	if hypervisor.IsSocketInUse(ctx, path) {
		return newRestoreFailure(
			restoreFailureExternalResourceBusy,
			fmt.Errorf("socket %s accepts connections but its owner could not be verified", path),
		)
	}
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return newRestoreFailure(restoreFailureProcessCleanupIncomplete, err)
	}
	return nil
}

func (b *Backend) cleanupFailedRestore(ctx context.Context, metadata *state.InstanceMetadata, process hypervisor.Process) error {
	if metadata == nil {
		return newRestoreFailure(restoreFailureProcessCleanupIncomplete, errors.New("runtime metadata is required"))
	}
	var cleanupErrors []error
	if err := b.terminateVMM(*metadata, process); err != nil {
		cleanupErrors = append(cleanupErrors, fmt.Errorf("terminate failed restore VMM: %w", err))
	}
	for _, artifact := range []struct {
		name string
		path string
	}{
		{name: "API socket", path: metadata.SocketPath},
		{name: "vsock socket", path: metadata.VsockSocket},
	} {
		if err := removeVerifiedStaleSocket(ctx, artifact.path); err != nil {
			cleanupErrors = append(cleanupErrors, fmt.Errorf("remove failed restore %s: %w", artifact.name, err))
		}
	}
	pidPath := b.paths.InstancePID(metadata.ID)
	if err := os.Remove(pidPath); err != nil && !errors.Is(err, os.ErrNotExist) {
		cleanupErrors = append(cleanupErrors, fmt.Errorf("remove failed restore PID record: %w", err))
	}
	if err := errors.Join(cleanupErrors...); err != nil {
		return newRestoreFailure(restoreFailureProcessCleanupIncomplete, err)
	}
	return nil
}
