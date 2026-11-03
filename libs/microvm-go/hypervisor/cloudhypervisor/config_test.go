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

package cloudhypervisor

import (
	"encoding/json"
	"testing"

	"github.com/snapflowio/microvm-go/hypervisor"
)

func TestToVMConfig(t *testing.T) {
	cfg := hypervisor.VM{
		VCPUs:         2,
		MemoryBytes:   512 * 1024 * 1024,
		SerialLogPath: "/logs/app.log",
		SocketPath:    "/runtime/instance/vmm/ch.sock",
		Jail:          hypervisor.JailPaths{Writable: []string{"/runtime/instance/vmm", "/runtime/instance/snapshots"}},
		KernelPath:    "/kernel",
		InitrdPath:    "/initrd",
		KernelArgs:    "console=ttyS0",
		Disks: []hypervisor.Disk{
			{Path: "/rootfs.erofs", Readonly: true},
			{Path: "/overlay.raw"},
		},
		Networks: []hypervisor.Network{{
			TAPDevice: "sfabc123",
			IP:        "172.31.0.2",
			MAC:       "02:00:00:00:00:01",
			Netmask:   "255.255.0.0",
		}},
		VsockCID:    42,
		VsockSocket: "/vsock.sock",
		PCIDevices:  []string{"/sys/bus/pci/devices/0000:01:00.0"},
		GuestMemory: hypervisor.GuestMemoryConfig{
			EnableBalloon:     true,
			DeflateOnOOM:      true,
			FreePageReporting: true,
		},
	}

	vm := toVMConfig(cfg)
	assertLandlockRules(t, vm)
	assertVMResources(t, vm)
	assertVMDevices(t, vm, cfg)
	fast := toVMConfig(hypervisor.VM{})
	if fast.Serial == nil || fast.Serial.Mode != "Off" || fast.Serial.File != nil {
		t.Fatalf("unexpected disabled serial: %#v", fast.Serial)
	}
}

func assertLandlockRules(t *testing.T, vm vmConfig) {
	t.Helper()
	if !vm.LandlockEnable {
		t.Fatal("expected Cloud Hypervisor Landlock confinement to be enabled")
	}
	if len(vm.LandlockRules) != 3 || vm.LandlockRules[0].Path != "/runtime/instance/vmm" || vm.LandlockRules[1].Path != "/runtime/instance/snapshots" || vm.LandlockRules[1].Access != landlockReadWriteAccess {
		t.Fatalf("unexpected Landlock rules: %#v", vm.LandlockRules)
	}
	if vm.LandlockRules[2].Path != "/sys/devices/virtual/net/sfabc123" || vm.LandlockRules[2].Access != landlockReadAccess {
		t.Fatalf("unexpected TAP Landlock rule: %#v", vm.LandlockRules[2])
	}
}

func assertVMResources(t *testing.T, vm vmConfig) {
	t.Helper()
	if vm.Cpus == nil || vm.Cpus.BootVcpus != 2 || vm.Cpus.MaxVcpus != 2 {
		t.Fatalf("unexpected cpus: %#v", vm.Cpus)
	}
	if vm.Memory == nil || vm.Memory.Size != 512*1024*1024 {
		t.Fatalf("unexpected memory: %#v", vm.Memory)
	}
	if vm.Disks == nil || len(*vm.Disks) != 2 {
		t.Fatalf("unexpected disks: %#v", vm.Disks)
	}
	if vm.Net == nil || len(*vm.Net) != 1 {
		t.Fatalf("unexpected networks: %#v", vm.Net)
	}
}

func assertVMDevices(t *testing.T, vm vmConfig, cfg hypervisor.VM) {
	t.Helper()
	if vm.Vsock == nil || vm.Vsock.Cid != 42 || vm.Vsock.Socket != "/vsock.sock" {
		t.Fatalf("unexpected vsock: %#v", vm.Vsock)
	}
	if vm.Devices == nil || len(*vm.Devices) != 1 {
		t.Fatalf("unexpected devices: %#v", vm.Devices)
	}
	if vm.Balloon == nil || vm.Balloon.DeflateOnOom == nil || !*vm.Balloon.DeflateOnOom {
		t.Fatalf("unexpected balloon: %#v", vm.Balloon)
	}
	if vm.Serial == nil || vm.Serial.Mode != "File" || vm.Serial.File == nil || *vm.Serial.File != cfg.SerialLogPath {
		t.Fatalf("unexpected serial: %#v", vm.Serial)
	}
}

func TestToVMConfigEmitsDirectOnlyForDirectDisks(t *testing.T) {
	const directDiskIndex = 1
	vm := toVMConfig(hypervisor.VM{Disks: []hypervisor.Disk{
		{Path: "/rootfs.erofs", Readonly: true},
		{Path: "/overlay.raw", Direct: true},
		{Path: "/config.img", Readonly: true},
	}})
	encoded, err := json.Marshal(vm.Disks)
	if err != nil {
		t.Fatal(err)
	}
	var disks []map[string]any
	if err := json.Unmarshal(encoded, &disks); err != nil {
		t.Fatal(err)
	}
	for index, disk := range disks {
		direct, present := disk["direct"]
		if present != (index == directDiskIndex) || (present && direct != true) {
			t.Fatalf("disk %d direct = %v (present %t), want direct only on disk %d", index, direct, present, directDiskIndex)
		}
	}
}
