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

	"github.com/snapflowio/microvm-go/internal/admission"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/types"
)

func (b *Backend) AllocatedResources(ctx context.Context) (types.AllocatedResources, error) {
	if err := ctx.Err(); err != nil {
		return types.AllocatedResources{}, err
	}
	allocated := allocatedResources(b.admission.Committed())
	allocated.DiskGiB -= b.admission.Allocation(templateCacheAllocationID).DiskGiB
	return allocated, nil
}

func (b *Backend) Capacity(ctx context.Context) (types.AllocatedResources, error) {
	if err := ctx.Err(); err != nil {
		return types.AllocatedResources{}, err
	}
	return allocatedResources(b.admission.Capacity()), nil
}

func allocatedResources(resources admission.Resources) types.AllocatedResources {
	return types.AllocatedResources{
		CPUVCPUs:  resources.CPUVCPUs,
		MemoryGiB: resources.MemoryGiB,
		DiskGiB:   resources.DiskGiB,
		GPUCount:  resources.GPUCount,
	}
}

func (b *Backend) admissionAllocations(ctx context.Context) ([]admission.Allocation, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	listing, err := state.ListInstances(b.paths)
	if err != nil {
		return nil, err
	}
	allocations := make([]admission.Allocation, 0, len(listing.Instances)+1)
	for _, metadata := range listing.Instances {
		if metadata.State == types.RuntimeStateDestroyed {
			continue
		}
		allocations = append(allocations, admission.Allocation{ID: metadata.ID, Resources: instanceAllocation(metadata)})
	}
	volumes, err := b.volumes.List(ctx)
	if err != nil {
		return nil, err
	}
	for _, volume := range volumes {
		allocations = append(allocations, admission.Allocation{
			ID:        volumeAllocationPrefix + volume.ID,
			Resources: admission.Resources{DiskGiB: volume.SizeGiB},
		})
	}
	support, err := b.supportDiskAllocations(listing.Instances)
	if err != nil {
		return nil, err
	}
	return append(allocations, support...), nil
}

func stateConsumesCompute(runtimeState types.RuntimeState) bool {
	switch runtimeState {
	case types.RuntimeStateCreating,
		types.RuntimeStateRestoring,
		types.RuntimeStateStarted,
		types.RuntimeStatePaused,
		types.RuntimeStateStarting,
		types.RuntimeStateStopping,
		types.RuntimeStateResizing:
		return true
	default:
		return false
	}
}

func (b *Backend) ImageCount(context.Context) (int, error) {
	return b.images.Count()
}

func bytesToGiBCeil(bytes int64) int64 {
	if bytes <= 0 {
		return 0
	}
	return (bytes + bytesPerGiB - 1) / bytesPerGiB
}
