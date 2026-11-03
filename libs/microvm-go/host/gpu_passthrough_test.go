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

package host

import "testing"

const (
	nvidiaSMIBusID     = "00000000:01:00.0"
	secondNVIDIASMIBus = "00000000:02:00.0"
	sysfsBusID         = "0000:01:00.0"
	secondSysfsBusID   = "0000:02:00.0"
	assignedIOMMUGroup = 12
	secondIOMMUGroup   = 13
)

func TestPassthroughCapableCountIgnoresGPUsWithoutAPassthroughPath(t *testing.T) {
	inventory := HostGPUInfo{Devices: []HostGPUDevice{
		{PCIAddress: normalizePCIBusID(nvidiaSMIBusID)},
		{PCIAddress: normalizePCIBusID(secondNVIDIASMIBus)},
	}}
	for _, test := range []struct {
		name       string
		discovered []GPUDevice
		want       int
	}{
		{name: "WSL exposes the GPU without a PCI device", discovered: nil, want: 0},
		{
			name:       "the PCI device has no IOMMU group",
			discovered: []GPUDevice{{PCIAddress: sysfsBusID, IOMMUGroup: noIOMMUGroup}},
			want:       0,
		},
		{
			name:       "one of two GPUs can be passed through",
			discovered: []GPUDevice{{PCIAddress: sysfsBusID, IOMMUGroup: assignedIOMMUGroup}},
			want:       1,
		},
		{
			name: "every GPU can be passed through",
			discovered: []GPUDevice{
				{PCIAddress: sysfsBusID, IOMMUGroup: assignedIOMMUGroup},
				{PCIAddress: secondSysfsBusID, IOMMUGroup: secondIOMMUGroup},
			},
			want: 2,
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			if got := passthroughCapableCount(inventory, test.discovered); got != test.want {
				t.Fatalf("passthroughCapableCount() = %d, want %d", got, test.want)
			}
		})
	}
}

func TestPassthroughCapableCountIgnoresDiscoveredDevicesOutsideTheInventory(t *testing.T) {
	discovered := []GPUDevice{{PCIAddress: sysfsBusID, IOMMUGroup: assignedIOMMUGroup}}
	if got := passthroughCapableCount(HostGPUInfo{}, discovered); got != 0 {
		t.Fatalf("passthroughCapableCount() = %d, want 0", got)
	}
}
