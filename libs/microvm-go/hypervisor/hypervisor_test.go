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

package hypervisor

import (
	"context"
	"strings"
	"testing"

	"github.com/snapflowio/microvm-go/types"
)

func TestSelectRequestedHonorsExplicitHypervisor(t *testing.T) {
	selected, err := SelectRequested(context.Background(), types.CreateRequest{Hypervisor: " FIRECRACKER "}, HypervisorCloudHypervisor)
	if err != nil {
		t.Fatal(err)
	}
	if selected != HypervisorFirecracker {
		t.Fatalf("selected = %q, want %q", selected, HypervisorFirecracker)
	}
	if _, err := SelectRequested(context.Background(), types.CreateRequest{Hypervisor: "unknown"}, HypervisorCloudHypervisor); err == nil {
		t.Fatal("expected invalid explicit hypervisor to be rejected")
	}
}

func TestParseVMStateNormalizesBackendValues(t *testing.T) {
	for input, expected := range map[string]VMState{
		"Running":  VMStateRunning,
		" paused ": VMStatePaused,
	} {
		actual, err := ParseVMState(input)
		if err != nil {
			t.Fatalf("ParseVMState(%q): %v", input, err)
		}
		if actual != expected {
			t.Fatalf("ParseVMState(%q) = %q, want %q", input, actual, expected)
		}
	}
	if _, err := ParseVMState("created"); err == nil || !strings.Contains(err.Error(), "created") {
		t.Fatalf("ParseVMState(created) error = %v", err)
	}
}

func TestSelectHypervisorUsesCloudHypervisorForGPU(t *testing.T) {
	selected := selectHypervisorForHost(types.CreateRequest{GPUQuota: 1}, HypervisorFirecracker)
	if selected != HypervisorCloudHypervisor {
		t.Fatalf("expected cloud-hypervisor for GPU instance, got %s", selected)
	}
}

func TestSelectHypervisorUsesFirecrackerForEphemeralProfile(t *testing.T) {
	selected := selectHypervisorForHost(types.CreateRequest{
		Labels: map[string]string{InstanceProfileLabel: string(InstanceProfileEphemeral)},
	}, HypervisorCloudHypervisor)
	if selected != HypervisorFirecracker {
		t.Fatalf("expected firecracker for ephemeral instance, got %s", selected)
	}
}

func TestSelectHypervisorUsesCloudHypervisorForServiceProfile(t *testing.T) {
	selected := selectHypervisorForHost(types.CreateRequest{
		Labels: map[string]string{InstanceProfileLabel: string(InstanceProfileService)},
	}, HypervisorFirecracker)
	if selected != HypervisorCloudHypervisor {
		t.Fatalf("expected cloud-hypervisor for service instance, got %s", selected)
	}
}
