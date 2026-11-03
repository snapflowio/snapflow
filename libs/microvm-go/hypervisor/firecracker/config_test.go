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

package firecracker

import (
	"context"
	"encoding/json"
	"errors"
	"path/filepath"
	"testing"

	"github.com/snapflowio/microvm-go/hypervisor"
)

func TestToDriveConfigs(t *testing.T) {
	cfg := hypervisor.VM{
		Disks: []hypervisor.Disk{
			{Path: "/rootfs.erofs", Readonly: true, IOBps: 1024, IOBurstBps: 4096},
			{Path: "/overlay.raw", Readonly: false},
		},
	}

	drives := toDriveConfigs(cfg)
	if len(drives) != 2 {
		t.Fatalf("expected 2 drives, got %d", len(drives))
	}
	if drives[0].DriveID != "rootfs" || !drives[0].IsRootDevice || !drives[0].IsReadOnly {
		t.Fatalf("unexpected root drive: %#v", drives[0])
	}
	if drives[0].RateLimiter == nil || drives[0].RateLimiter.Bandwidth == nil {
		t.Fatalf("expected root drive rate limiter")
	}
	if drives[0].RateLimiter.Bandwidth.Size != 1024 {
		t.Fatalf("unexpected bandwidth size %d", drives[0].RateLimiter.Bandwidth.Size)
	}
	if drives[1].DriveID != "disk1" || drives[1].IsRootDevice || drives[1].IsReadOnly {
		t.Fatalf("unexpected second drive: %#v", drives[1])
	}
}

func TestToSnapshotLoadParamsUsesFileMemory(t *testing.T) {
	dir := t.TempDir()
	params := toSnapshotLoadParams(dir, hypervisor.VM{})
	if params.MemBackend.BackendType != snapshotMemoryBackendFile {
		t.Fatalf("backend type = %q", params.MemBackend.BackendType)
	}
	if params.MemBackend.BackendPath != filepath.Join(dir, "memory") {
		t.Fatalf("backend path = %q", params.MemBackend.BackendPath)
	}
	if params.ResumeVM {
		t.Fatal("snapshot load must remain paused until guest identity is rotated")
	}
	encoded, err := json.Marshal(params)
	if err != nil {
		t.Fatal(err)
	}
	if string(encoded) == "" || json.Valid(encoded) == false {
		t.Fatal("snapshot load parameters are not valid JSON")
	}
	if containsJSONField(encoded, "vsock_override") {
		t.Fatal("empty Firecracker snapshot load must omit vsock_override")
	}
	if !params.ClockRealtime {
		t.Fatal("snapshot load must advance the guest wall clock")
	}
}

func TestToSnapshotLoadParamsOverridesVsockPath(t *testing.T) {
	socket := filepath.Join(t.TempDir(), "instance.vsock")
	params := toSnapshotLoadParams("/snapshot", hypervisor.VM{
		VsockCID:    7,
		VsockSocket: socket,
	})
	if params.VsockOverride == nil || params.VsockOverride.UDSPath != socket {
		t.Fatalf("vsock override = %#v, want %s", params.VsockOverride, socket)
	}
}

func containsJSONField(data []byte, field string) bool {
	value := make(map[string]json.RawMessage)
	if err := json.Unmarshal(data, &value); err != nil {
		return false
	}
	_, exists := value[field]
	return exists
}

func TestToNetworkInterfaces(t *testing.T) {
	cfg := hypervisor.VM{
		Networks: []hypervisor.Network{{
			TAPDevice:   "sfabc123",
			MAC:         "02:00:00:00:00:01",
			DownloadBps: 1_000_000,
			UploadBps:   2_000_000,
		}},
	}

	networks := toNetworkInterfaces(cfg)
	if len(networks) != 1 {
		t.Fatalf("expected 1 network, got %d", len(networks))
	}
	if networks[0].IfaceID != "eth0" || networks[0].HostDevName != "sfabc123" || networks[0].GuestMAC != "02:00:00:00:00:01" {
		t.Fatalf("unexpected network config: %#v", networks[0])
	}
	if networks[0].RxRateLimiter == nil || networks[0].TxRateLimiter == nil {
		t.Fatalf("expected network rate limiters")
	}
}

func TestBackendRejectsDirectDisks(t *testing.T) {
	cfg := hypervisor.VM{Disks: []hypervisor.Disk{
		{Path: "/rootfs.erofs", Readonly: true},
		{Path: "/overlay.raw", Direct: true},
	}}
	backend := NewBackend()
	if _, err := backend.Start(context.Background(), cfg); !errors.Is(err, errDirectDiskUnsupported) {
		t.Fatalf("Start() error = %v, want %v", err, errDirectDiskUnsupported)
	}
	if _, err := backend.Restore(context.Background(), cfg, t.TempDir()); !errors.Is(err, errDirectDiskUnsupported) {
		t.Fatalf("Restore() error = %v, want %v", err, errDirectDiskUnsupported)
	}
}
