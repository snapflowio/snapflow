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

package microvm

import (
	"errors"
	"testing"

	"github.com/snapflowio/microvm-go/devices"
)

func TestOfferedCapacityCapsEachResourceAtTheSmallerOfOfferedAndAdmittable(t *testing.T) {
	admittable := Capacity{CPUVCPUs: 8, MemoryGiB: 32, DiskGiB: 247, GPUCount: 1}
	for _, test := range []struct {
		name  string
		offer Offer
		want  Capacity
	}{
		{name: "all admittable", offer: Offer{}, want: admittable},
		{
			name:  "offered below admittable",
			offer: Offer{CPUVCPUs: 4, MemoryGiB: 8, DiskGiB: 24},
			want:  Capacity{CPUVCPUs: 4, MemoryGiB: 8, DiskGiB: 24, GPUCount: 1},
		},
		{
			name:  "offered above admittable",
			offer: Offer{CPUVCPUs: 64, MemoryGiB: 512, DiskGiB: 1024},
			want:  admittable,
		},
		{
			name:  "only memory offered",
			offer: Offer{MemoryGiB: 8},
			want:  Capacity{CPUVCPUs: 8, MemoryGiB: 8, DiskGiB: 247, GPUCount: 1},
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			capacity, err := offeredCapacity(admittable, test.offer)
			if err != nil {
				t.Fatalf("offeredCapacity() error = %v", err)
			}
			if capacity != test.want {
				t.Fatalf("offeredCapacity() = %+v, want %+v", capacity, test.want)
			}
		})
	}
}

func TestCapacityProbeFollowsFreeSpaceUnderTheOperatorCap(t *testing.T) {
	const gpuCount = 1
	freeDiskGiB := int64(0)
	probe := capacityProbe(func() (Capacity, error) {
		return Capacity{CPUVCPUs: 8, MemoryGiB: 32, DiskGiB: freeDiskGiB}, nil
	}, func() (int64, error) { return gpuCount, nil }, Offer{DiskGiB: 100})
	for _, test := range []struct{ free, want int64 }{{free: 200, want: 100}, {free: 60, want: 60}, {free: 150, want: 100}} {
		freeDiskGiB = test.free
		capacity, err := probe()
		if err != nil {
			t.Fatalf("probe() error = %v", err)
		}
		if capacity.DiskGiB != test.want || capacity.GPUCount != gpuCount {
			t.Fatalf("probe() with %d GiB free = %+v, want %d GiB disk and %d GPU", test.free, capacity, test.want, gpuCount)
		}
	}
}

func TestOfferedCapacityRejectsNegativeOffers(t *testing.T) {
	admittable := Capacity{CPUVCPUs: 1, MemoryGiB: 1, DiskGiB: 1}
	for _, offer := range []Offer{{CPUVCPUs: -1}, {MemoryGiB: -1}, {DiskGiB: -1}} {
		if _, err := offeredCapacity(admittable, offer); err == nil {
			t.Fatalf("offeredCapacity() accepted the negative offer %+v", offer)
		}
	}
}

func TestListableGPUsLeavesQuarantinedGPUsOut(t *testing.T) {
	quarantine := devices.NewGPUQuarantine(t.TempDir())
	if err := quarantine.Add("0000:0a:00.0", errors.New("scrub failed")); err != nil {
		t.Fatal(err)
	}
	for _, test := range []struct{ passthrough, want int64 }{{passthrough: 2, want: 1}, {passthrough: 0, want: 0}} {
		count, err := listableGPUs(test.passthrough, quarantine)()
		if err != nil || count != test.want {
			t.Fatalf("listableGPUs(%d)() = %d, %v; want %d", test.passthrough, count, err, test.want)
		}
	}
}
