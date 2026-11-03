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
	"context"
	"testing"

	"github.com/snapflowio/microvm-go/internal/admission"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/layout"
	"github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/microvm-go/volumes"
)

func TestResizeReservesTargetResourcesAtomically(t *testing.T) {
	paths := layout.NewPaths(t.TempDir())
	backend := &Backend{paths: paths, volumes: volumes.NewManager(paths)}
	controller, err := admission.NewController(
		admission.Resources{CPUVCPUs: 4, MemoryGiB: 8, DiskGiB: 20, GPUCount: 1, NetworkSlots: 2},
	)
	if err != nil {
		t.Fatal(err)
	}
	backend.admission = controller

	active := state.InstanceMetadata{
		ID:           "active",
		CPUQuota:     2,
		MemoryQuota:  4,
		StorageQuota: 5,
		State:        types.RuntimeStateStarted,
	}
	stopped := state.InstanceMetadata{
		ID:           "stopped",
		CPUQuota:     1,
		MemoryQuota:  2,
		StorageQuota: 5,
		State:        types.RuntimeStateStopped,
		RawRequest:   types.CreateRequest{ID: "stopped"},
	}
	for _, metadata := range []state.InstanceMetadata{active, stopped} {
		if err := state.WriteInstanceMetadata(paths, metadata); err != nil {
			t.Fatal(err)
		}
	}
	if err := backend.resynchronizeAllocations(context.Background()); err != nil {
		t.Fatal(err)
	}

	targetCPU, targetMemory, targetGPU := int64(3), int64(4), int64(0)
	err = backend.resizeLocked(context.Background(), stopped.ID, types.ResizeRequest{
		CPU:    &targetCPU,
		Memory: &targetMemory,
		GPU:    &targetGPU,
	})
	if err == nil {
		t.Fatal("resize succeeded despite insufficient aggregate CPU capacity")
	}

	unchanged, err := state.ReadInstanceMetadata(paths, stopped.ID)
	if err != nil {
		t.Fatal(err)
	}
	if unchanged.CPUQuota != 1 || unchanged.MemoryQuota != 2 {
		t.Fatalf("failed resize changed metadata: CPU=%d memory=%d", unchanged.CPUQuota, unchanged.MemoryQuota)
	}
}
