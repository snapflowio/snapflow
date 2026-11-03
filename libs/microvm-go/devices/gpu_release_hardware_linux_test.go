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
	"testing"
	"time"

	"github.com/snapflowio/microvm-go/host"
)

// gpuTestEnvironment gates the test that takes a real GPU away from the host
// driver and back. It must not run on a machine serving tenants.
const gpuTestEnvironment = "SNAPFLOW_GPU_TEST"

func TestMain(m *testing.M) {
	Init()
	os.Exit(m.Run())
}

func TestReleaseReturnsAPassthroughGPUCleanToTheHost(t *testing.T) {
	if os.Getenv(gpuTestEnvironment) == "" || os.Geteuid() != 0 {
		t.Skipf("needs root, an idle NVIDIA GPU and %s=1", gpuTestEnvironment)
	}
	discovered, err := host.DiscoverPassthroughGPUs()
	if err != nil {
		t.Fatal(err)
	}
	var inventory []GPUInventoryDevice
	for _, device := range discovered {
		if device.CurrentDriver == nvidiaDriver {
			inventory = append(inventory, GPUInventoryDevice{PCIAddress: device.PCIAddress, Model: device.DeviceName})
		}
	}
	if len(inventory) == 0 {
		t.Skip("no GPU is bound to the nvidia driver")
	}
	quarantine := NewGPUQuarantine(t.TempDir())
	manager := NewGPUManager(inventory[:1], quarantine)

	started := time.Now()
	assigned, err := manager.Assign(t.Context(), GPURequest{Count: 1}, nil)
	if err != nil {
		t.Fatalf("assign: %v", err)
	}
	for _, binding := range assigned[0].Bindings {
		if driver := pciDriver(binding.PCIAddress); driver != vfioPCIDriver {
			t.Fatalf("%s is on %q after assign, want %q", binding.PCIAddress, driver, vfioPCIDriver)
		}
	}
	t.Logf("assigned IOMMU group %d (%d functions) in %s", assigned[0].IOMMUGroup, len(assigned[0].Bindings), time.Since(started))

	started = time.Now()
	if err := manager.Release(t.Context(), assigned); err != nil {
		t.Fatalf("release: %v", err)
	}
	t.Logf("released, health-checked and scrubbed in %s", time.Since(started))
	for _, binding := range assigned[0].Bindings {
		if driver := pciDriver(binding.PCIAddress); driver != binding.OriginalDriver {
			t.Fatalf("%s is on %q after release, want %q", binding.PCIAddress, driver, binding.OriginalDriver)
		}
	}
	quarantined, err := quarantine.List()
	if err != nil {
		t.Fatal(err)
	}
	if entry, held := quarantined[normalizePCIAddress(assigned[0].PCIAddress)]; held {
		t.Fatalf("release quarantined the GPU: %s", entry.Reason)
	}
}
