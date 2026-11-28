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
	"net/http"
	"path/filepath"

	"github.com/snapflowio/microvm-go/devices"
	"github.com/snapflowio/microvm-go/hypervisor"
	mvmerrors "github.com/snapflowio/microvm-go/internal/errors"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/types"
)

func (b *Backend) assignGPUDevices(ctx context.Context, metadata state.InstanceMetadata) ([]devices.GPUDevice, error) {
	if metadata.GPUQuota <= 0 {
		return nil, nil
	}
	if metadata.Hypervisor != hypervisor.HypervisorCloudHypervisor {
		return nil, mvmerrors.New(
			http.StatusConflict,
			fmt.Sprintf("GPU instances require %s, got %s", hypervisor.HypervisorCloudHypervisor, metadata.Hypervisor),
			"MICROVM_GPU_REQUIRES_CLOUD_HYPERVISOR",
		)
	}
	b.gpuAllocationMu.Lock()
	defer b.gpuAllocationMu.Unlock()
	activeAssignments, err := b.activeGPUAssignmentsLocked(metadata.ID)
	if err != nil {
		return nil, mvmerrors.New(
			http.StatusFailedDependency,
			fmt.Sprintf("inspect active GPU assignments: %v", err),
			"MICROVM_GPU_ASSIGNMENT_STATE_UNAVAILABLE",
		)
	}
	gpuDevices, err := b.gpuDevices.Assign(ctx, devices.GPURequest{
		Count: metadata.GPUQuota,
		Model: metadata.GPUType,
		Commit: func(assignments []devices.GPUDevice) error {
			return b.writeGPULeaseJournal(metadata.ID, assignments)
		},
		Clear: func() error {
			return b.removeGPULeaseJournal(metadata.ID)
		},
	}, activeAssignments)
	if err != nil {
		return nil, mvmerrors.New(
			http.StatusFailedDependency,
			fmt.Sprintf("assign passthrough GPU devices: %v", err),
			"MICROVM_GPU_ASSIGNMENT_FAILED",
		)
	}
	paths := make([]string, 0, len(gpuDevices))
	for _, device := range gpuDevices {
		paths = appendGPUExclusions(paths, device)
	}
	b.pendingGPU[metadata.ID] = append([]string(nil), paths...)
	return gpuDevices, nil
}

func gpuPCIPaths(assignments []devices.GPUDevice) []string {
	paths := make([]string, 0, len(assignments))
	for _, assignment := range assignments {
		paths = append(paths, assignment.SysfsPath)
	}
	return paths
}

func (b *Backend) releaseGPUDevices(ctx context.Context, metadata *state.InstanceMetadata) error {
	if metadata == nil || len(metadata.GPUAssignments) == 0 {
		return nil
	}
	if err := b.gpuDevices.Release(ctx, metadata.GPUAssignments); err != nil {
		return err
	}
	if err := b.removeGPULeaseJournal(metadata.ID); err != nil {
		return err
	}
	metadata.GPUAssignments = nil
	metadata.PCIDevices = nil
	return nil
}

func (b *Backend) activeGPUAssignmentsLocked(excludeInstanceID string) (map[string]struct{}, error) {
	assignments := map[string]struct{}{}
	metadatas, err := state.ListInstanceMetadata(b.paths)
	if err != nil {
		return nil, fmt.Errorf("list instance metadata: %w", err)
	}
	for _, metadata := range metadatas {
		if metadata.ID != excludeInstanceID {
			addInstanceGPUExclusions(assignments, metadata)
		}
	}
	for instanceID, devices := range b.pendingGPU {
		if instanceID == excludeInstanceID {
			continue
		}
		for _, device := range devices {
			addGPUExclusion(assignments, device)
		}
	}
	return assignments, nil
}

func addInstanceGPUExclusions(assignments map[string]struct{}, metadata state.InstanceMetadata) {
	for _, device := range metadata.PCIDevices {
		addGPUExclusion(assignments, device)
	}
	for _, device := range metadata.GPUAssignments {
		addGPUExclusion(assignments, device.PCIAddress)
		addGPUExclusion(assignments, device.SysfsPath)
		for _, binding := range device.Bindings {
			addGPUExclusion(assignments, binding.PCIAddress)
		}
	}
}

func appendGPUExclusions(paths []string, device devices.GPUDevice) []string {
	paths = append(paths, device.PCIAddress, device.SysfsPath)
	for _, binding := range device.Bindings {
		paths = append(paths, binding.PCIAddress, filepath.Join("/sys/bus/pci/devices", binding.PCIAddress))
	}
	return paths
}

func addGPUExclusion(excluded map[string]struct{}, device string) {
	if device == "" {
		return
	}
	excluded[device] = struct{}{}
	if base := filepath.Base(device); base != "." && base != string(filepath.Separator) {
		excluded[base] = struct{}{}
		excluded[filepath.Join("/sys/bus/pci/devices", base)] = struct{}{}
	}
}

func (b *Backend) finishGPUAssignment(instanceID string) {
	b.gpuAllocationMu.Lock()
	delete(b.pendingGPU, instanceID)
	b.gpuAllocationMu.Unlock()
}

func reservesGPUDevices(runtimeState types.RuntimeState) bool {
	switch runtimeState {
	case types.RuntimeStateCreating,
		types.RuntimeStateStarting,
		types.RuntimeStateStarted,
		types.RuntimeStatePaused,
		types.RuntimeStateRestoring,
		types.RuntimeStateStopping,
		types.RuntimeStateDestroying:
		return true
	default:
		return false
	}
}
