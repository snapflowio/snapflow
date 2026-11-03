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
	"testing"

	"github.com/snapflowio/microvm-go/devices"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/layout"
	"github.com/snapflowio/microvm-go/types"
)

type failingGPUReleaseManager struct {
	err error
}

func (failingGPUReleaseManager) Assign(context.Context, devices.GPURequest, map[string]struct{}) ([]devices.GPUDevice, error) {
	return nil, errors.New("unexpected GPU assignment")
}

func (manager failingGPUReleaseManager) Release(context.Context, []devices.GPUDevice) error {
	return manager.err
}

type recordingGPUReleaseManager struct {
	released [][]devices.GPUDevice
	err      error
}

func (*recordingGPUReleaseManager) Assign(context.Context, devices.GPURequest, map[string]struct{}) ([]devices.GPUDevice, error) {
	return nil, errors.New("unexpected GPU assignment")
}

func (manager *recordingGPUReleaseManager) Release(ctx context.Context, assignments []devices.GPUDevice) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	manager.released = append(manager.released, append([]devices.GPUDevice(nil), assignments...))
	return manager.err
}

func TestStopRetainsGPUReservationWhenDriverRestoreFails(t *testing.T) {
	t.Parallel()
	paths := layout.NewPaths(t.TempDir())
	backend := &Backend{
		paths:      paths,
		gpuDevices: failingGPUReleaseManager{err: errors.New("restore failed")},
	}
	metadata := state.InstanceMetadata{
		ID:             "gpu-stop-failure",
		State:          types.RuntimeStateStarted,
		GPUQuota:       1,
		GPUAssignments: []devices.GPUDevice{{PCIAddress: "0000:01:00.0", IOMMUGroup: 1}},
		PCIDevices:     []string{"/sys/bus/pci/devices/0000:01:00.0"},
	}
	if err := state.WriteInstanceMetadata(paths, metadata); err != nil {
		t.Fatal(err)
	}

	if err := backend.stopLockedWithOptions(context.Background(), metadata.ID, types.StopOptions{}); err == nil {
		t.Fatal("stop succeeded despite a failed GPU driver restore")
	}
	persisted, err := state.ReadInstanceMetadata(paths, metadata.ID)
	if err != nil {
		t.Fatal(err)
	}
	if persisted.State != types.RuntimeStateStopping {
		t.Fatalf("failed stop became %s instead of retaining a stopping reservation", persisted.State)
	}
	if len(persisted.GPUAssignments) != 1 || !reservesGPUDevices(persisted.State) {
		t.Fatal("failed stop released its GPU allocation in persisted state")
	}
}

func TestActiveGPUAssignmentsExcludeCompleteIOMMUGroup(t *testing.T) {
	t.Parallel()
	paths := layout.NewPaths(t.TempDir())
	backend := &Backend{paths: paths, pendingGPU: map[string][]string{}}
	metadata := state.InstanceMetadata{
		ID:       "gpu-group-owner",
		State:    types.RuntimeStateError,
		GPUQuota: 1,
		GPUAssignments: []devices.GPUDevice{{
			PCIAddress: "0000:01:00.0",
			SysfsPath:  "/sys/bus/pci/devices/0000:01:00.0",
			IOMMUGroup: 1,
			Bindings: []devices.PCIDeviceBinding{
				{PCIAddress: "0000:01:00.0"},
				{PCIAddress: "0000:01:00.1"},
			},
		}},
		PCIDevices: []string{"/sys/bus/pci/devices/0000:01:00.0"},
	}
	if err := state.WriteInstanceMetadata(paths, metadata); err != nil {
		t.Fatal(err)
	}

	excluded, err := backend.activeGPUAssignmentsLocked("")
	if err != nil {
		t.Fatal(err)
	}
	for _, address := range []string{
		"0000:01:00.0",
		"0000:01:00.1",
		"/sys/bus/pci/devices/0000:01:00.0",
		"/sys/bus/pci/devices/0000:01:00.1",
	} {
		if _, ok := excluded[address]; !ok {
			t.Fatalf("IOMMU group member %s was not excluded", address)
		}
	}
}

func TestUnexpectedExitRestoresGPUDriversBeforePersistingStopped(t *testing.T) {
	t.Parallel()
	paths := layout.NewPaths(t.TempDir())
	manager := &recordingGPUReleaseManager{}
	backend := &Backend{paths: paths, gpuDevices: manager}
	metadata := state.InstanceMetadata{
		ID:             "gpu-unexpected-exit",
		State:          types.RuntimeStateStarted,
		GPUQuota:       1,
		GPUAssignments: []devices.GPUDevice{{PCIAddress: "0000:01:00.0", IOMMUGroup: 1}},
		PCIDevices:     []string{"/sys/bus/pci/devices/0000:01:00.0"},
	}
	if err := state.WriteInstanceMetadata(paths, metadata); err != nil {
		t.Fatal(err)
	}

	if err := backend.recordUnexpectedExit(context.Background(), &metadata); err != nil {
		t.Fatal(err)
	}
	if len(manager.released) != 1 || len(manager.released[0]) != 1 {
		t.Fatalf("GPU release calls = %#v, want one assignment", manager.released)
	}
	persisted, err := state.ReadInstanceMetadata(paths, metadata.ID)
	if err != nil {
		t.Fatal(err)
	}
	if persisted.State != types.RuntimeStateStopped {
		t.Fatalf("unexpected exit state = %s, want stopped", persisted.State)
	}
	if len(persisted.GPUAssignments) != 0 || len(persisted.PCIDevices) != 0 {
		t.Fatal("stopped instance retained a GPU lease")
	}
}

func TestUnexpectedExitRetainsGPUReservationWhenDriverRestoreFails(t *testing.T) {
	t.Parallel()
	paths := layout.NewPaths(t.TempDir())
	manager := &recordingGPUReleaseManager{err: errors.New("restore failed")}
	backend := &Backend{paths: paths, gpuDevices: manager}
	metadata := state.InstanceMetadata{
		ID:             "gpu-unexpected-exit-failure",
		State:          types.RuntimeStateStarted,
		GPUQuota:       1,
		GPUAssignments: []devices.GPUDevice{{PCIAddress: "0000:01:00.0", IOMMUGroup: 1}},
		PCIDevices:     []string{"/sys/bus/pci/devices/0000:01:00.0"},
	}
	if err := state.WriteInstanceMetadata(paths, metadata); err != nil {
		t.Fatal(err)
	}

	if err := backend.recordUnexpectedExit(context.Background(), &metadata); err == nil {
		t.Fatal("unexpected exit succeeded despite a failed GPU driver restore")
	}
	persisted, err := state.ReadInstanceMetadata(paths, metadata.ID)
	if err != nil {
		t.Fatal(err)
	}
	if persisted.State != types.RuntimeStateStarted || len(persisted.GPUAssignments) != 1 {
		t.Fatal("failed driver restore lost the durable GPU reservation")
	}
}

func TestStateDeductionRestoresGPUDriversForExitedInstance(t *testing.T) {
	t.Parallel()
	paths := layout.NewPaths(t.TempDir())
	manager := &recordingGPUReleaseManager{}
	backend := &Backend{paths: paths, gpuDevices: manager}
	metadata := state.InstanceMetadata{
		ID:             "gpu-state-deduction",
		State:          types.RuntimeStateStarted,
		GPUQuota:       1,
		GPUAssignments: []devices.GPUDevice{{PCIAddress: "0000:01:00.0", IOMMUGroup: 1}},
		PCIDevices:     []string{"/sys/bus/pci/devices/0000:01:00.0"},
	}
	if err := state.WriteInstanceMetadata(paths, metadata); err != nil {
		t.Fatal(err)
	}

	runtimeState, err := backend.deduceRuntimeStateLocked(context.Background(), metadata.ID)
	if err != nil {
		t.Fatal(err)
	}
	if runtimeState != types.RuntimeStateStopped || len(manager.released) != 1 {
		t.Fatalf("deduced state = %s releases = %d, want stopped and one release", runtimeState, len(manager.released))
	}
	persisted, err := state.ReadInstanceMetadata(paths, metadata.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(persisted.GPUAssignments) != 0 || len(persisted.PCIDevices) != 0 {
		t.Fatal("state deduction persisted stopped before clearing the GPU lease")
	}
}
