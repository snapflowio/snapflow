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

package vmm

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/snapflowio/microvm-go/hypervisor"
)

func TestManagerUsesOnlyConfiguredAssets(t *testing.T) {
	root := t.TempDir()
	assets := HostAssets{
		Firecracker:     testExecutable(t, root, "firecracker"),
		CloudHypervisor: testExecutable(t, root, "cloud-hypervisor"),
	}
	manager, err := NewManager(assets)
	if err != nil {
		t.Fatal(err)
	}
	resolved, err := manager.Resolve(context.Background(), hypervisor.HypervisorCloudHypervisor)
	if err != nil {
		t.Fatal(err)
	}
	if resolved != assets.CloudHypervisor {
		t.Fatalf("resolved %q, want %q", resolved, assets.CloudHypervisor)
	}
	firecrackerPath, err := manager.Resolve(context.Background(), hypervisor.HypervisorFirecracker)
	if err != nil {
		t.Fatal(err)
	}
	if firecrackerPath != assets.Firecracker {
		t.Fatalf("resolved %q, want %q", firecrackerPath, assets.Firecracker)
	}
}

func TestManagerRejectsMissingOrRelativeAssets(t *testing.T) {
	if _, err := NewManager(HostAssets{}); err == nil {
		t.Fatal("empty assets were accepted")
	}
	if _, err := NewManager(HostAssets{
		Firecracker: "firecracker", CloudHypervisor: "cloud-hypervisor",
	}); err == nil {
		t.Fatal("relative assets were accepted")
	}
}

func testExecutable(t *testing.T, root, name string) string {
	t.Helper()
	path := filepath.Join(root, name)
	if err := os.WriteFile(path, []byte(name), 0o755); err != nil {
		t.Fatal(err)
	}
	return path
}
