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
	"strings"
	"testing"

	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/hypervisor/cloudhypervisor"
	"github.com/snapflowio/microvm-go/hypervisor/firecracker"
	"github.com/snapflowio/microvm-go/internal/state"
)

func productionHypervisors() map[hypervisor.Hypervisor]HypervisorBackend {
	return map[hypervisor.Hypervisor]HypervisorBackend{
		hypervisor.HypervisorFirecracker:     firecracker.NewBackend(),
		hypervisor.HypervisorCloudHypervisor: cloudhypervisor.NewBackend(),
	}
}

func TestKernelArgsUseErofsRootfsOnEveryHypervisor(t *testing.T) {
	backend := &Backend{hypervisors: productionHypervisors()}
	for _, selected := range hypervisor.SupportedHypervisors() {
		args := backend.kernelArgsWithPolicy(state.InstanceMetadata{Hypervisor: selected}, backend.bootPolicy())
		if !strings.Contains(args, "rootfstype=erofs") {
			t.Fatalf("%s kernel args = %q, want erofs rootfs", selected, args)
		}
	}
}

func TestFastFirecrackerKernelArgsDisableSerialDevice(t *testing.T) {
	backend := &Backend{serialConsole: false, hypervisors: productionHypervisors()}
	args := backend.kernelArgsWithPolicy(state.InstanceMetadata{Hypervisor: hypervisor.HypervisorFirecracker}, backend.bootPolicy())
	if strings.Contains(args, "console=") || !strings.Contains(args, "8250.nr_uarts=0") {
		t.Fatalf("fast Firecracker kernel args = %q", args)
	}
}

func TestSerialConsoleUsesTheHypervisorConsoleDevice(t *testing.T) {
	backend := &Backend{serialConsole: true, hypervisors: productionHypervisors()}
	for selected, want := range map[hypervisor.Hypervisor]string{
		hypervisor.HypervisorFirecracker:     "console=ttyS0 ",
		hypervisor.HypervisorCloudHypervisor: "console=ttyS0 ",
	} {
		args := backend.kernelArgsWithPolicy(state.InstanceMetadata{Hypervisor: selected}, backend.bootPolicy())
		if !strings.HasPrefix(args, want) || strings.Contains(args, "8250.nr_uarts=0") {
			t.Fatalf("%s kernel args = %q, want console prefix %q", selected, args, want)
		}
	}
}

func TestInternalBuilderKeepsSerialConsoleWhenSandboxConsoleIsDisabled(t *testing.T) {
	backend := &Backend{serialConsole: false}
	builder := state.InstanceMetadata{
		Hypervisor: hypervisor.HypervisorCloudHypervisor,
		Labels:     map[string]string{internalBuilderLabel: internalBuilderLabelValue},
	}
	if !backend.instanceBootPolicy(builder).serialConsole {
		t.Fatal("internal builder boot policy disabled the serial console its exit status is read from")
	}
	sandbox := state.InstanceMetadata{Hypervisor: hypervisor.HypervisorCloudHypervisor}
	if backend.instanceBootPolicy(sandbox).serialConsole {
		t.Fatal("sandbox boot policy enabled the serial console the backend disabled")
	}
}
