// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package telemetry

import (
	"context"
	"testing"
	"time"

	microvmtypes "github.com/snapflowio/microvm-go/types"
)

const (
	testOfferedVCPUs     = 4
	testOfferedMemoryGiB = 8
	testOfferedDiskGiB   = 24
	testPassthroughGPUs  = 2
	testCPUPercent       = 12.5
)

type capacityRuntime struct{}

func (capacityRuntime) AllocatedResources(context.Context) (microvmtypes.AllocatedResources, error) {
	return microvmtypes.AllocatedResources{}, nil
}

func (capacityRuntime) Capacity(context.Context) (microvmtypes.AllocatedResources, error) {
	return microvmtypes.AllocatedResources{CPUVCPUs: testOfferedVCPUs, MemoryGiB: testOfferedMemoryGiB, DiskGiB: testOfferedDiskGiB, GPUCount: testPassthroughGPUs}, nil
}

func (capacityRuntime) ImageCount(context.Context) (int, error) {
	return 0, nil
}

func (capacityRuntime) RuntimeInventory(context.Context) ([]microvmtypes.RuntimeObservation, error) {
	return nil, nil
}

func TestCollectReportsTheAdmissionCapacity(t *testing.T) {
	collector, err := NewCollector(CollectorConfig{
		DataDir:                            t.TempDir(),
		WindowSize:                         1,
		CPUUsageSnapshotInterval:           time.Second,
		AllocatedResourcesSnapshotInterval: time.Second,
	}, capacityRuntime{})
	if err != nil {
		t.Fatalf("NewCollector() error = %v", err)
	}
	collector.cpuRing.Value = CPUSnapshot{timestamp: time.Now(), cpuPercent: testCPUPercent}
	metrics, err := collector.collect(t.Context())
	if err != nil {
		t.Fatalf("collect() error = %v", err)
	}
	if metrics.CPUCapacity != testOfferedVCPUs || metrics.MemoryCapacityGiB != testOfferedMemoryGiB ||
		metrics.DiskCapacityGiB != testOfferedDiskGiB || metrics.GPUCapacity != testPassthroughGPUs {
		t.Fatalf("capacity = %v vCPUs, %v GiB memory, %v GiB disk, %d GPUs, want %d, %d, %d, %d",
			metrics.CPUCapacity, metrics.MemoryCapacityGiB, metrics.DiskCapacityGiB, metrics.GPUCapacity,
			testOfferedVCPUs, testOfferedMemoryGiB, testOfferedDiskGiB, testPassthroughGPUs)
	}
}
