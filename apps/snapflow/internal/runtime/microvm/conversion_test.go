// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the License at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package microvm

import (
	"slices"
	"testing"

	"github.com/snapflowio/microvm-go/guest"
	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	"github.com/snapflowio/snapflow/internal/workload"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const conversionSandboxID = "7f1c2b9e-3d4a-4c5b-8e6f-1a2b3c4d5e6f"

func conversionRequest(capabilities ...workload.SandboxCapability) sandboxruntime.MaterializeRequest {
	values := make([]string, 0, len(capabilities))
	for _, capability := range capabilities {
		values = append(values, string(capability))
	}
	return sandboxruntime.MaterializeRequest{
		Assignment: sandboxruntime.Assignment{SandboxID: conversionSandboxID, Generation: 1},
		Spec: &machinev1alpha1.SandboxSpec{
			Mode: string(workload.SandboxModeStandard), Capabilities: values, UserId: "user", OsUser: "root",
			Resources: &machinev1alpha1.SandboxResources{CpuQuota: 1, MemoryQuota: 1, StorageQuota: 1},
			Source:    &machinev1alpha1.SandboxSpec_Image{Image: &machinev1alpha1.SandboxImage{Ref: "example.com/image:latest"}},
		},
	}
}

func TestCreateRequestMapsDirectIOOutOfTheGuestCapabilities(t *testing.T) {
	request, err := toMicroVMCreateRequest(conversionRequest(
		workload.SandboxCapabilityDeveloperTools, workload.SandboxCapabilityDirectIO,
	))
	if err != nil {
		t.Fatal(err)
	}
	if !request.DirectIO {
		t.Fatal("the direct-io capability did not request direct I/O")
	}
	if !slices.Equal(request.Capabilities, []guest.SandboxCapability{guest.SandboxCapabilityDeveloperTools}) {
		t.Fatalf("guest capabilities = %v, want only developer tools", request.Capabilities)
	}
}

func TestCreateRequestKeepsBufferedIOWithoutDirectIO(t *testing.T) {
	request, err := toMicroVMCreateRequest(conversionRequest(workload.SandboxCapabilityDeveloperTools))
	if err != nil {
		t.Fatal(err)
	}
	if request.DirectIO {
		t.Fatal("a sandbox without the direct-io capability requested direct I/O")
	}
}
