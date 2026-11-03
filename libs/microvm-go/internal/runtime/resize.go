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

	mvmerrors "github.com/snapflowio/microvm-go/internal/errors"
	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/types"
)

func (b *Backend) Resize(ctx context.Context, instanceID string, request types.ResizeRequest) error {
	return runLifecycleAction(b, instanceID, lifecycle.OperationResize, func() error {
		guard, err := b.lifecycle.Lock(ctx, instanceID)
		if err != nil {
			return fmt.Errorf("acquire instance lifecycle lock: %w", err)
		}
		defer guard.Release()
		return b.resizeLocked(ctx, instanceID, request)
	})
}

func (b *Backend) resizeLocked(ctx context.Context, instanceID string, request types.ResizeRequest) error {
	metadata, err := b.readResizableInstance(instanceID, request)
	if err != nil {
		return err
	}
	target := resizeTarget{
		cpu:     resizedValue(request.CPU, metadata.CPUQuota),
		gpu:     resizedValue(request.GPU, metadata.GPUQuota),
		memory:  resizedValue(request.Memory, metadata.MemoryQuota),
		storage: resizedValue(request.Storage, metadata.StorageQuota),
	}
	if target.storage < metadata.StorageQuota {
		return mvmerrors.NewInvalidRequest(fmt.Errorf(
			"root disk cannot shrink from %d GiB to %d GiB",
			metadata.StorageQuota,
			target.storage,
		))
	}
	targetResources := requestedResources(
		target.cpu,
		target.memory,
		target.storage+metadata.AdditionalDiskQuota,
		target.gpu,
	)
	targetResources.NetworkSlots = instanceNetworkSlots(metadata)
	if err := b.validateResourceShape(targetResources); err != nil {
		return err
	}
	reservation, err := b.reserveResources(ctx, instanceID, targetResources)
	if err != nil {
		return err
	}
	defer reservation.Finish()
	if len(metadata.GPUAssignments) > 0 {
		if err := b.releaseGPUDevices(ctx, &metadata); err != nil {
			return fmt.Errorf("release stale GPU lease before resize: %w", err)
		}
	}
	if target.storage > metadata.StorageQuota {
		if err := growOverlayDisk(ctx, metadata.OverlayDisk, target.storage); err != nil {
			return fmt.Errorf("expand root overlay disk: %w", err)
		}
	}
	target.apply(&metadata)
	return b.writeInstance(metadata)
}

type resizeTarget struct {
	cpu     int64
	gpu     int64
	memory  int64
	storage int64
}

func (target resizeTarget) apply(metadata *state.InstanceMetadata) {
	metadata.CPUQuota = target.cpu
	metadata.GPUQuota = target.gpu
	metadata.MemoryQuota = target.memory
	metadata.StorageQuota = target.storage
	metadata.RawRequest.CPUQuota = target.cpu
	metadata.RawRequest.GPUQuota = target.gpu
	metadata.RawRequest.MemoryQuota = target.memory
	metadata.RawRequest.StorageQuota = target.storage
	if metadata.GPUQuota == 0 {
		metadata.PCIDevices = nil
	}
}

func (b *Backend) readResizableInstance(instanceID string, request types.ResizeRequest) (state.InstanceMetadata, error) {
	metadata, err := state.ReadInstanceMetadata(b.paths, instanceID)
	if errors.Is(err, os.ErrNotExist) {
		return state.InstanceMetadata{}, mvmerrors.NewNotFound(fmt.Errorf("instance %s", instanceID))
	}
	if err != nil {
		return state.InstanceMetadata{}, err
	}
	if err := b.admitAssignmentGeneration(&metadata, request.AssignmentGeneration); err != nil {
		return state.InstanceMetadata{}, err
	}
	if err := validateRequestedTransition(lifecycle.OperationResize, metadata.State); err != nil {
		return state.InstanceMetadata{}, err
	}
	return metadata, nil
}

func resizedValue(requested *int64, current int64) int64 {
	if requested == nil {
		return current
	}
	return *requested
}
