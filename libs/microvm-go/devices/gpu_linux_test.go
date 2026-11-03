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

//go:build linux

package devices

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/snapflowio/microvm-go/host"
)

func TestClearPCIDriverOverrideWritesSysfsEmptyString(t *testing.T) {
	t.Parallel()
	directory := t.TempDir()
	path := filepath.Join(directory, "driver_override")
	if err := os.WriteFile(path, []byte("vfio-pci"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := clearPCIDriverOverride(directory); err != nil {
		t.Fatal(err)
	}
	value, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(value) != "\n" {
		t.Fatalf("driver override clear wrote %q instead of a sysfs empty string", value)
	}
}

func TestNormalizeGPUModelIgnoresNVIDIAVendorPrefix(t *testing.T) {
	t.Parallel()
	if normalizeGPUModel("NVIDIA GeForce RTX 5070") != normalizeGPUModel("GeForce RTX 5070") {
		t.Fatal("equivalent NVIDIA model names did not normalize identically")
	}
}

func TestEligibleDevicesSkipsQuarantinedGPUs(t *testing.T) {
	t.Parallel()
	const healthy, quarantined = "0000:0a:00.0", "0000:0b:00.0"
	manager, ok := NewGPUManager([]GPUInventoryDevice{{PCIAddress: healthy}, {PCIAddress: quarantined}}, nil).(PassthroughGPUManager)
	if !ok {
		t.Fatal("NewGPUManager() did not return a PassthroughGPUManager")
	}
	discovered := []host.GPUDevice{{PCIAddress: healthy, IOMMUGroup: 1}, {PCIAddress: quarantined, IOMMUGroup: 2}}
	eligible := manager.eligibleDevices(discovered, GPURequest{Count: 1}, nil, map[string]QuarantinedGPU{quarantined: {}})
	if len(eligible) != 1 || eligible[0].PCIAddress != healthy {
		t.Fatalf("eligibleDevices() = %+v, want only %s", eligible, healthy)
	}
}

func TestUniqueGroupsKeepsOneAssignmentPerGroupNewestFirst(t *testing.T) {
	t.Parallel()
	groups := uniqueGroups([]GPUDevice{
		{PCIAddress: "0000:0a:00.0", IOMMUGroup: 1},
		{PCIAddress: "0000:0b:00.0", IOMMUGroup: 2},
		{PCIAddress: "0000:0a:00.1", IOMMUGroup: 1},
	})
	if len(groups) != 2 || groups[0].PCIAddress != "0000:0a:00.1" || groups[1].PCIAddress != "0000:0b:00.0" {
		t.Fatalf("uniqueGroups() = %+v, want one entry per group, newest first", groups)
	}
}
