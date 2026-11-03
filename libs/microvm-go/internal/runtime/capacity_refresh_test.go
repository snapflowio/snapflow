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
	"errors"
	"testing"

	"github.com/snapflowio/microvm-go/internal/admission"
	"github.com/snapflowio/microvm-go/network"
)

func TestRefreshCapacityFollowsTheHostProbe(t *testing.T) {
	backend := newLedgerBackend(t)
	backend.networks = network.NewManager(network.DefaultConfig().Normalized())
	freeDiskGiB := int64(0)
	backend.capacity = func() (admission.Resources, error) {
		return admission.Resources{CPUVCPUs: 64, MemoryGiB: 256, DiskGiB: freeDiskGiB}, nil
	}
	for _, free := range []int64{512, 40, 300} {
		freeDiskGiB = free
		if err := backend.refreshCapacity(); err != nil {
			t.Fatalf("refreshCapacity() error = %v", err)
		}
		capacity := backend.admission.Capacity()
		if capacity.DiskGiB != free || capacity.NetworkSlots != backend.networks.Capacity() {
			t.Fatalf("capacity = %+v, want %d GiB disk and %d network slots", capacity, free, backend.networks.Capacity())
		}
	}
}

func TestRefreshCapacityKeepsTheLastCapacityWhenTheProbeFails(t *testing.T) {
	backend := newLedgerBackend(t)
	backend.networks = network.NewManager(network.DefaultConfig().Normalized())
	before := backend.admission.Capacity()
	probeErr := errors.New("statfs failed")
	backend.capacity = func() (admission.Resources, error) { return admission.Resources{}, probeErr }
	if err := backend.refreshCapacity(); !errors.Is(err, probeErr) {
		t.Fatalf("refreshCapacity() error = %v, want %v", err, probeErr)
	}
	if after := backend.admission.Capacity(); after != before {
		t.Fatalf("capacity = %+v after a failed probe, want %+v", after, before)
	}
}
