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
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/snapflowio/microvm-go/internal/admission"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/internal/template"
	"github.com/snapflowio/microvm-go/layout"
	"github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/microvm-go/volumes"
)

func newLedgerBackend(t *testing.T) *Backend {
	t.Helper()
	paths := layout.NewPaths(t.TempDir())
	controller, err := admission.NewController(admission.Resources{CPUVCPUs: 64, MemoryGiB: 256, DiskGiB: 1024, NetworkSlots: 64})
	if err != nil {
		t.Fatal(err)
	}
	return &Backend{paths: paths, volumes: volumes.NewManager(paths), admission: controller}
}

func recomputedAllocation(t *testing.T, backend *Backend) admission.Resources {
	t.Helper()
	allocations, err := backend.admissionAllocations(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	total := admission.Resources{}
	for _, allocation := range allocations {
		if allocation.ID == supportDiskAllocationID || allocation.ID == templateCacheAllocationID {
			continue
		}
		total.CPUVCPUs += allocation.Resources.CPUVCPUs
		total.MemoryGiB += allocation.Resources.MemoryGiB
		total.DiskGiB += allocation.Resources.DiskGiB
		total.GPUCount += allocation.Resources.GPUCount
		total.NetworkSlots += allocation.Resources.NetworkSlots
	}
	return total
}

func TestLedgerFollowsLifecycleWritesWithoutRescanning(t *testing.T) {
	backend := newLedgerBackend(t)
	states := []types.RuntimeState{
		types.RuntimeStateCreating,
		types.RuntimeStateStarted,
		types.RuntimeStateStopping,
		types.RuntimeStateStopped,
		types.RuntimeStateStarted,
		types.RuntimeStatePaused,
	}
	for index := range 6 {
		metadata := state.InstanceMetadata{
			ID:           fmt.Sprintf("instance-%d", index),
			CPUQuota:     int64(index + 1),
			MemoryQuota:  2,
			StorageQuota: 10,
			State:        types.RuntimeStateCreating,
			Network:      testAllocation(fmt.Sprintf("instance-%d", index), index),
		}
		if err := backend.writeInstance(metadata); err != nil {
			t.Fatal(err)
		}
		for _, next := range states[:index+1] {
			if err := backend.persistRuntimeState(&metadata, next); err != nil {
				t.Fatal(err)
			}
		}
		if got, want := backend.admission.Committed(), recomputedAllocation(t, backend); got != want {
			t.Fatalf("after instance %d: ledger %+v, recomputed %+v", index, got, want)
		}
	}
	if err := backend.removeInstanceStateDirectories("instance-3"); err != nil {
		t.Fatal(err)
	}
	if got, want := backend.admission.Committed(), recomputedAllocation(t, backend); got != want {
		t.Fatalf("after removal: ledger %+v, recomputed %+v", got, want)
	}
}

func TestFinishedReservationAccountsForDirectMetadataWrites(t *testing.T) {
	backend := newLedgerBackend(t)
	reservation, err := backend.reserveResources(context.Background(), "fork-target", admission.Resources{DiskGiB: 10, NetworkSlots: 1})
	if err != nil {
		t.Fatal(err)
	}
	if err := state.WriteInstanceMetadata(backend.paths, state.InstanceMetadata{
		ID:           "fork-target",
		StorageQuota: 10,
		State:        types.RuntimeStateStandby,
		Network:      testAllocation("fork-target", 9),
	}); err != nil {
		t.Fatal(err)
	}
	reservation.Finish()
	if got, want := backend.admission.Committed(), recomputedAllocation(t, backend); got != want {
		t.Fatalf("ledger %+v, recomputed %+v", got, want)
	}
}

type removingSeeds struct {
	paths layout.Paths
}

func (removingSeeds) BuildSeed(context.Context, types.CreateRequest) error {
	return errors.New("removing seeds do not boot guests")
}

func (seeds removingSeeds) DestroySeed(ctx context.Context, seedID string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	return os.RemoveAll(seeds.paths.InstanceDir(seedID))
}

func TestCreateShortOnDiskEvictsCachedTemplates(t *testing.T) {
	const (
		templateKey  = "cached-key"
		seedID       = "cached-seed"
		seedBytes    = 4096
		filePerm     = 0o600
		dirPerm      = 0o755
		requestedGiB = 1
	)
	paths := layout.NewPaths(t.TempDir())
	controller, err := admission.NewController(admission.Resources{CPUVCPUs: 1, MemoryGiB: 1, DiskGiB: requestedGiB})
	if err != nil {
		t.Fatal(err)
	}
	backend := &Backend{
		paths:     paths,
		admission: controller,
		templates: template.New(template.Config{Paths: paths}, removingSeeds{paths: paths}),
	}
	if err := state.WriteInstanceMetadata(paths, state.InstanceMetadata{ID: seedID, State: types.RuntimeStateStandby, TemplateSeed: true}); err != nil {
		t.Fatal(err)
	}
	snapshot := filepath.Join(paths.InstanceDir(seedID), "snapshots", "memory")
	if err := os.MkdirAll(filepath.Dir(snapshot), dirPerm); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(snapshot, make([]byte, seedBytes), filePerm); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(paths.SystemTemplate(templateKey), dirPerm); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(paths.SystemTemplateManifest(templateKey), []byte(`{"seedId":"`+seedID+`"}`), filePerm); err != nil {
		t.Fatal(err)
	}
	if err := backend.sampleSupportDisk(); err != nil {
		t.Fatal(err)
	}
	if available := controller.Available().DiskGiB; available != 0 {
		t.Fatalf("available disk before eviction = %d GiB, want 0", available)
	}

	backend.reclaimTemplateDisk(context.Background(), requestedGiB)

	if available := controller.Available().DiskGiB; available != requestedGiB {
		t.Fatalf("available disk after eviction = %d GiB, want %d", available, requestedGiB)
	}
	if _, err := os.Stat(paths.InstanceDir(seedID)); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("the evicted template seed was kept: %v", err)
	}
}

func TestSupportInstancesAreMeasuredInsteadOfReservingDiskQuota(t *testing.T) {
	seed := state.InstanceMetadata{ID: "seed", StorageQuota: 3, State: types.RuntimeStateStandby, TemplateSeed: true}
	builder := state.InstanceMetadata{
		ID:                  "builder",
		StorageQuota:        20,
		AdditionalDiskQuota: 20,
		State:               types.RuntimeStateStarted,
		Labels:              map[string]string{internalBuilderLabel: internalBuilderLabelValue},
	}
	workload := state.InstanceMetadata{ID: "workload", StorageQuota: 3, State: types.RuntimeStateStandby}
	for _, support := range []state.InstanceMetadata{seed, builder} {
		if disk := instanceAllocation(support).DiskGiB; disk != 0 {
			t.Fatalf("%s reserves %d GiB of disk quota, want 0", support.ID, disk)
		}
	}
	if disk := instanceAllocation(workload).DiskGiB; disk != workload.StorageQuota {
		t.Fatalf("workload reserves %d GiB of disk quota, want %d", disk, workload.StorageQuota)
	}
	support := supportInstances([]state.InstanceMetadata{seed, builder, workload})
	if !slices.Equal(support.TemplateSeeds, []string{seed.ID}) || !slices.Equal(support.Builders, []string{builder.ID}) {
		t.Fatalf("supportInstances() = %+v, want seed %s and builder %s", support, seed.ID, builder.ID)
	}
}

func TestReportedAllocationLeavesOutTheReclaimableTemplateCache(t *testing.T) {
	backend := newLedgerBackend(t)
	backend.admission.Set(supportDiskAllocationID, admission.Resources{DiskGiB: 4})
	backend.admission.Set(templateCacheAllocationID, admission.Resources{DiskGiB: 30})

	allocated, err := backend.AllocatedResources(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if allocated.DiskGiB != 4 {
		t.Fatalf("reported disk allocation = %d GiB, want the 4 GiB of fixed support disk", allocated.DiskGiB)
	}
	if available := backend.admission.Available().DiskGiB; available != 1024-34 {
		t.Fatalf("admission still has %d GiB available, want the template cache counted", available)
	}
}
