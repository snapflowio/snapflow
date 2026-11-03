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
	"log/slog"
	"sort"

	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/types"
)

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
		info, err := backend.RuntimeInfo(ctx, metadata[index].ID)
		if err != nil {
			slog.Warn("runtime inspection degraded to durable metadata", "instance_id", metadata[index].ID, "error", err)
			info = runtimeInfoFromMetadata(metadata[index])
		}
		observations = append(observations, types.RuntimeObservation{
			ID:                  metadata[index].ID,
			Identity:            metadata[index].Identity,
			GenerationID:        metadata[index].GenerationID,
			Image:               metadata[index].Image,
			Info:                info,
			ControlPlaneManaged: controlPlaneManaged(metadata[index]),
			InspectionComplete:  err == nil,
		})
	}
	return observations, nil
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
