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
	"sort"
	"time"

	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/types"
)

const inventoryLockWait = 500 * time.Millisecond

func (backend *Backend) RuntimeInventory(ctx context.Context) ([]types.RuntimeObservation, error) {
	listing, err := state.ListInstances(backend.paths)
	if err != nil {
		return nil, fmt.Errorf("list runtime inventory: %w", err)
	}
	for instanceID, readErr := range listing.Unreadable {
		slog.WarnContext(ctx, "runtime inventory omits quarantined instance", "instance_id", instanceID, "error", readErr)
	}
	metadata := listing.Instances
	sort.Slice(metadata, func(left, right int) bool {
		return metadata[left].ID < metadata[right].ID
	})
	observations := make([]types.RuntimeObservation, 0, len(metadata))
	for index := range metadata {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		observations = append(observations, backend.observeIdle(ctx, metadata[index]))
	}
	return observations, nil
}

func (backend *Backend) RuntimeObservation(ctx context.Context, instanceID string) (types.RuntimeObservation, bool, error) {
	guard, err := backend.lifecycle.Lock(ctx, instanceID)
	if err != nil {
		return types.RuntimeObservation{}, false, fmt.Errorf("acquire instance lifecycle lock: %w", err)
	}
	defer guard.Release()
	metadata, err := state.ReadInstanceMetadata(backend.paths, instanceID)
	if errors.Is(err, os.ErrNotExist) {
		return types.RuntimeObservation{}, false, nil
	}
	if err != nil {
		return types.RuntimeObservation{}, false, fmt.Errorf("read instance %s: %w", instanceID, err)
	}
	return backend.observeLocked(ctx, metadata), true, nil
}

func (backend *Backend) observeIdle(ctx context.Context, metadata state.InstanceMetadata) types.RuntimeObservation {
	lockContext, cancel := context.WithTimeout(ctx, inventoryLockWait)
	defer cancel()
	guard, err := backend.lifecycle.Lock(lockContext, metadata.ID)
	if err != nil {
		return observation(metadata, runtimeInfoFromMetadata(metadata), false)
	}
	defer guard.Release()
	return backend.observeLocked(ctx, metadata)
}

func (backend *Backend) observeLocked(ctx context.Context, metadata state.InstanceMetadata) types.RuntimeObservation {
	info, err := backend.runtimeInfoLocked(ctx, metadata.ID)
	if err != nil {
		slog.WarnContext(ctx, "runtime inspection degraded to durable metadata", "instance_id", metadata.ID, "error", err)
		return observation(metadata, runtimeInfoFromMetadata(metadata), false)
	}
	return observation(metadata, info, true)
}

func observation(metadata state.InstanceMetadata, info types.RuntimeInfo, complete bool) types.RuntimeObservation {
	return types.RuntimeObservation{
		ID:                  metadata.ID,
		Identity:            metadata.Identity,
		GenerationID:        metadata.GenerationID,
		Image:               metadata.Image,
		Info:                info,
		ControlPlaneManaged: controlPlaneManaged(metadata),
		BuildTenant:         metadata.BuildTenant,
		InspectionComplete:  complete,
	}
}

func (backend *Backend) PreparedImageDigests(ctx context.Context) ([]string, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	digests, err := backend.images.ReadyDigests()
	if err != nil {
		return nil, fmt.Errorf("list prepared image digests: %w", err)
	}
	return digests, nil
}

func controlPlaneManaged(metadata state.InstanceMetadata) bool {
	return !metadata.TemplateSeed && !isInternalBuilder(metadata)
}

func runtimeInfoFromMetadata(metadata state.InstanceMetadata) types.RuntimeInfo {
	return types.RuntimeInfo{
		State:              metadata.State,
		CPUVCPUs:           metadata.CPUQuota,
		MemoryGiB:          metadata.MemoryQuota,
		StorageGiB:         metadata.StorageQuota,
		HealthCheck:        metadata.HealthCheck,
		HealthCheckRuntime: metadata.HealthCheckRuntime,
		RestartPolicy:      metadata.RestartPolicy,
		RestartStatus:      metadata.RestartStatus,
		ExitCode:           metadata.ExitCode,
		ExitMessage:        metadata.ExitMessage,
	}
}
