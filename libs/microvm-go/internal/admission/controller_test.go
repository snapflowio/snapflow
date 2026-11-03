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

package admission

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"sync"
	"sync/atomic"
	"testing"
)

func newTestController(t *testing.T, capacity Resources) *Controller {
	t.Helper()
	controller, err := NewController(capacity)
	if err != nil {
		t.Fatal(err)
	}
	return controller
}

func TestControllerIncludesPendingReservations(t *testing.T) {
	controller := newTestController(t, Resources{CPUVCPUs: 4, MemoryGiB: 8, DiskGiB: 100})
	first, err := controller.Reserve(context.Background(), "first", Resources{CPUVCPUs: 3, MemoryGiB: 4, DiskGiB: 10})
	if err != nil {
		t.Fatal(err)
	}
	defer first.Finish()

	_, err = controller.Reserve(context.Background(), "second", Resources{CPUVCPUs: 2, MemoryGiB: 1, DiskGiB: 1})
	var insufficient *InsufficientError
	if !errors.As(err, &insufficient) || insufficient.Resource != ResourceCPU {
		t.Fatalf("Reserve() error = %v, want CPU InsufficientError", err)
	}
}

func TestControllerReplacesCurrentAllocation(t *testing.T) {
	controller := newTestController(t, Resources{CPUVCPUs: 4, MemoryGiB: 8, DiskGiB: 100})
	controller.Set("instance", Resources{DiskGiB: 10})
	reservation, err := controller.Reserve(context.Background(), "instance", Resources{CPUVCPUs: 4, MemoryGiB: 8, DiskGiB: 10})
	if err != nil {
		t.Fatal(err)
	}
	reservation.Finish()
	reservation.Finish()
}

func TestControllerReportsCommittedAllocation(t *testing.T) {
	controller := newTestController(t, Resources{CPUVCPUs: 4, MemoryGiB: 8, DiskGiB: 100})
	controller.Replace([]Allocation{{ID: "existing", Resources: Resources{CPUVCPUs: 3, MemoryGiB: 6, DiskGiB: 20}}})
	_, err := controller.Reserve(context.Background(), "new", Resources{CPUVCPUs: 2, MemoryGiB: 1, DiskGiB: 1})
	var insufficient *InsufficientError
	if !errors.As(err, &insufficient) || insufficient.Allocated != 3 || insufficient.Available != 1 {
		t.Fatalf("Reserve() error = %#v", err)
	}
}

func TestControllerReportsWhatCommittedAndPendingAllocationsLeaveAvailable(t *testing.T) {
	controller := newTestController(t, Resources{CPUVCPUs: 4, MemoryGiB: 8, DiskGiB: 100})
	controller.Set("existing", Resources{CPUVCPUs: 1, MemoryGiB: 2, DiskGiB: 30})
	reservation, err := controller.Reserve(context.Background(), "pending", Resources{CPUVCPUs: 2, MemoryGiB: 1, DiskGiB: 10})
	if err != nil {
		t.Fatal(err)
	}
	defer reservation.Finish()
	if available, want := controller.Available(), (Resources{CPUVCPUs: 1, MemoryGiB: 5, DiskGiB: 60}); available != want {
		t.Fatalf("Available() = %+v, want %+v", available, want)
	}
}

func TestControllerAdmitsCommittedAllocationsOnlyWithinCapacity(t *testing.T) {
	controller := newTestController(t, Resources{CPUVCPUs: 4, MemoryGiB: 8, DiskGiB: 100})
	controller.Set("existing", Resources{DiskGiB: 70})
	err := controller.Admit("build", Resources{DiskGiB: 40})
	var insufficient *InsufficientError
	if !errors.As(err, &insufficient) || insufficient.Resource != ResourceDisk {
		t.Fatalf("Admit() over capacity error = %v, want disk InsufficientError", err)
	}
	if err := controller.Admit("build", Resources{DiskGiB: 30}); err != nil {
		t.Fatalf("Admit() within capacity error = %v", err)
	}
	if committed := controller.Committed(); committed.DiskGiB != 100 {
		t.Fatalf("Committed() = %+v, want the admitted disk committed", committed)
	}
}

func TestControllerReleasesRemovedAllocations(t *testing.T) {
	controller := newTestController(t, Resources{CPUVCPUs: 4, MemoryGiB: 8, DiskGiB: 100})
	controller.Set("existing", Resources{CPUVCPUs: 4, MemoryGiB: 8})
	controller.Remove("existing")
	reservation, err := controller.Reserve(context.Background(), "new", Resources{CPUVCPUs: 4, MemoryGiB: 8})
	if err != nil {
		t.Fatalf("Reserve() after Remove error = %v", err)
	}
	reservation.Finish()
	if committed := controller.Committed(); committed != (Resources{}) {
		t.Fatalf("Committed() = %+v, want empty", committed)
	}
}

func TestControllerReportsTheCapacityAdmissionEnforces(t *testing.T) {
	controller := newTestController(t, Resources{CPUVCPUs: 4, MemoryGiB: 8, DiskGiB: 100})
	updated := Resources{CPUVCPUs: 4, MemoryGiB: 8, DiskGiB: 24}
	if err := controller.UpdateCapacity(updated); err != nil {
		t.Fatalf("UpdateCapacity() error = %v", err)
	}
	if capacity := controller.Capacity(); capacity != updated {
		t.Fatalf("Capacity() = %+v, want %+v", capacity, updated)
	}
	_, err := controller.Reserve(context.Background(), "disk", Resources{DiskGiB: 25})
	var insufficient *InsufficientError
	if !errors.As(err, &insufficient) || insufficient.Capacity != updated.DiskGiB {
		t.Fatalf("Reserve() error = %#v", err)
	}
}

func TestLedgerTotalsMatchARecomputationAfterRandomOperations(t *testing.T) {
	controller := newTestController(t, Resources{CPUVCPUs: 1 << 20, MemoryGiB: 1 << 20, DiskGiB: 1 << 20, NetworkSlots: 1 << 20})
	random := rand.New(rand.NewPCG(1, 2))
	model := make(map[string]Resources)
	for step := range 5_000 {
		id := fmt.Sprintf("instance-%d", random.IntN(64))
		switch random.IntN(4) {
		case 0:
			controller.Remove(id)
			delete(model, id)
		case 1:
			allocations := make([]Allocation, 0, len(model))
			for allocationID, resources := range model {
				allocations = append(allocations, Allocation{ID: allocationID, Resources: resources})
			}
			controller.Replace(allocations)
		default:
			resources := Resources{
				CPUVCPUs:     random.Int64N(8),
				MemoryGiB:    random.Int64N(16),
				DiskGiB:      random.Int64N(64),
				NetworkSlots: random.Int64N(2),
			}
			controller.Set(id, resources)
			if resources == (Resources{}) {
				delete(model, id)
			} else {
				model[id] = resources
			}
		}
		expected := Resources{}
		for _, resources := range model {
			expected = expected.add(resources)
		}
		if committed := controller.Committed(); committed != expected {
			t.Fatalf("step %d: ledger total %+v, recomputed %+v", step, committed, expected)
		}
	}
}

func TestConcurrentReservationsNeverOvercommit(t *testing.T) {
	const (
		capacityCPU = 16
		workers     = 64
		rounds      = 200
	)
	controller := newTestController(t, Resources{CPUVCPUs: capacityCPU, MemoryGiB: capacityCPU, DiskGiB: capacityCPU})
	var inUse, peak atomic.Int64
	var group sync.WaitGroup
	for worker := range workers {
		group.Go(func() {
			id := fmt.Sprintf("worker-%d", worker)
			for range rounds {
				reservation, err := controller.Reserve(context.Background(), id, Resources{CPUVCPUs: 1, MemoryGiB: 1, DiskGiB: 1})
				if err != nil {
					var insufficient *InsufficientError
					if !errors.As(err, &insufficient) {
						t.Errorf("Reserve() error = %v", err)
					}
					continue
				}
				current := inUse.Add(1)
				for {
					seen := peak.Load()
					if current <= seen || peak.CompareAndSwap(seen, current) {
						break
					}
				}
				controller.Set(id, Resources{CPUVCPUs: 1, MemoryGiB: 1, DiskGiB: 1})
				inUse.Add(-1)
				controller.Remove(id)
				reservation.Finish()
			}
		})
	}
	group.Wait()
	if peak.Load() > capacityCPU {
		t.Fatalf("peak concurrent admissions = %d, capacity %d", peak.Load(), capacityCPU)
	}
	if committed := controller.Committed(); committed != (Resources{}) {
		t.Fatalf("Committed() after all workers finished = %+v", committed)
	}
	if pending := controller.pendingTotal; pending != (Resources{}) {
		t.Fatalf("pending total after all workers finished = %+v", pending)
	}
}

func TestControllerCountsCPUsInWholeCores(t *testing.T) {
	controller := newTestController(t, Resources{CPUVCPUs: 4, MemoryGiB: 8, DiskGiB: 100})
	controller.RoundCPUsTo(2)
	controller.Set("odd", Resources{CPUVCPUs: 1, MemoryGiB: 1})
	if committed := controller.Committed(); committed.CPUVCPUs != 2 {
		t.Fatalf("committed %d vCPUs for a 1-vCPU VM, want a whole 2-thread core", committed.CPUVCPUs)
	}
	if _, err := controller.Reserve(context.Background(), "three", Resources{CPUVCPUs: 3}); err == nil {
		t.Fatal("Reserve() admitted 3 vCPUs (two whole cores) with only one free core")
	}
	if _, err := controller.Reserve(context.Background(), "two", Resources{CPUVCPUs: 2}); err != nil {
		t.Fatalf("Reserve() refused a whole free core: %v", err)
	}
}
