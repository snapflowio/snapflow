// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package snapshot

import (
	"context"
	"slices"
	"testing"

	microvmtypes "github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/snapflow/internal/state"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const (
	prewarmRef            = "registry.example.com/snapflow/prewarm:1.0"
	secondCold            = "registry.example.com/snapflow/cold:1.0"
	coldImages            = 2
	keptImages            = 2
	totalImages           = 5
	pressureCapacityBytes = 7 * testSizeBytes / 2
)

func TestDiskPressureReclaimsColdSnapshotsBeforePrewarmedOnes(t *testing.T) {
	runtime := newFakeRuntime()
	records := newFakeRecords()
	for _, ref := range []string{snapshotRef, inUseRef, prewarmRef, unwantedRef, secondCold} {
		holdRecorded(t, runtime, records, ref)
	}
	runtime.inventory = []microvmtypes.RuntimeObservation{{ID: "sandbox", Image: inUseRef}}
	test := newHarness(t, runtime, records)
	test.disk.measure(runtime, pressureCapacityBytes)
	// Stop the background loop once the store has started: as soon as the
	// collection relieves the pressure it would pull the pre-warmed snapshot
	// again (TestPrewarmedSnapshotWaitsForDiskPressureRelief covers that), and
	// this test checks the collection alone.
	stop := test.run(t)
	stop()
	test.store.Apply(1, []*machinev1alpha1.DesiredSnapshot{registrySnapshot(snapshotRef), prewarmSnapshot(prewarmRef)})
	if held := runtime.heldBytes(); held != totalImages*testSizeBytes {
		t.Fatalf("runtime holds %d bytes before the collection, want %d", held, totalImages*testSizeBytes)
	}

	if err := test.store.collect(context.Background()); err != nil {
		t.Fatalf("collect: %v", err)
	}

	removed := runtime.removedRefs()
	if len(removed) != coldImages+1 {
		t.Fatalf("removed %v, want both cold snapshots and then the pre-warmed one", removed)
	}
	if cold := removed[:coldImages]; !slices.Contains(cold, unwantedRef) || !slices.Contains(cold, secondCold) {
		t.Fatalf("removed %v first, want the cold snapshots before any pre-warmed one", cold)
	}
	if removed[coldImages] != prewarmRef {
		t.Fatalf("removed %s last, want the pre-warmed %s", removed[coldImages], prewarmRef)
	}
	if held := runtime.heldBytes(); held != keptImages*testSizeBytes {
		t.Fatalf("runtime holds %d bytes after the collection, want %d reclaimed", held, (totalImages-keptImages)*testSizeBytes)
	}
	for _, ref := range removed {
		if records.has(ref) {
			t.Fatalf("removed snapshot %s is still recorded", ref)
		}
	}
	for _, ref := range []string{snapshotRef, inUseRef} {
		if state, _ := test.inventoryState(ref); state != present {
			t.Fatalf("%s is %s, want present", ref, state)
		}
	}
}

func TestPrewarmedSnapshotWaitsForDiskPressureRelief(t *testing.T) {
	runtime := newFakeRuntime()
	test := newHarness(t, runtime, newFakeRecords())
	test.disk.usage = pressureUsage
	test.run(t)
	test.store.Apply(1, nil)
	if err := test.store.collect(context.Background()); err != nil {
		t.Fatalf("collect: %v", err)
	}

	test.store.Apply(2, []*machinev1alpha1.DesiredSnapshot{prewarmSnapshot(prewarmRef)})
	test.store.converge(t.Context())
	if got := runtime.pullCount(prewarmRef); got != 0 {
		t.Fatalf("pulled a pre-warmed snapshot %d times under disk pressure", got)
	}

	test.disk.usage = relievedUsage
	if err := test.store.collect(context.Background()); err != nil {
		t.Fatalf("collect: %v", err)
	}
	test.store.signal()
	eventually(t, "the pre-warmed snapshot is present once the pressure is relieved", func() bool {
		state, _ := test.inventoryState(prewarmRef)
		return state == present
	})
}

func TestPrewarmedSnapshotIsKeptWithoutDiskPressure(t *testing.T) {
	runtime := newFakeRuntime()
	records := newFakeRecords()
	holdRecorded(t, runtime, records, prewarmRef)
	test := newHarness(t, runtime, records)
	test.run(t)
	test.store.Apply(1, []*machinev1alpha1.DesiredSnapshot{prewarmSnapshot(prewarmRef)})

	test.clock.advance(2 * testGracePeriod)
	if err := test.store.collect(context.Background()); err != nil {
		t.Fatalf("collect: %v", err)
	}

	if removed := runtime.removedRefs(); len(removed) != 0 {
		t.Fatalf("removed %v without disk pressure, want the pre-warmed snapshot kept", removed)
	}
}

func TestRemovingASnapshotRemovesItsTemplateFirst(t *testing.T) {
	runtime := newFakeRuntime()
	records := newFakeRecords()
	runtime.hold(unwantedRef)
	record := state.SnapshotRecord{
		Ref: unwantedRef, Digest: testDigest, SizeBytes: testSizeBytes,
		Template: &machinev1alpha1.PreparedTemplate{Key: testTemplateKey},
	}
	if err := records.SaveSnapshotRecord(context.Background(), record); err != nil {
		t.Fatal(err)
	}
	test := newHarness(t, runtime, records)
	test.disk.usage = pressureUsage
	test.run(t)
	test.store.Apply(1, nil)

	if err := test.store.collect(context.Background()); err != nil {
		t.Fatalf("collect: %v", err)
	}

	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	want := []string{templateRemoval + testTemplateKey, imageRemoval + unwantedRef}
	if !slices.Equal(runtime.removals, want) {
		t.Fatalf("removed %v, want the template before the image it holds: %v", runtime.removals, want)
	}
}

func TestSharedTemplateOutlivesOneOfItsSnapshots(t *testing.T) {
	runtime := newFakeRuntime()
	records := newFakeRecords()
	for _, ref := range []string{snapshotRef, unwantedRef} {
		runtime.hold(ref)
		record := state.SnapshotRecord{
			Ref: ref, Digest: testDigest, SizeBytes: testSizeBytes,
			Template: &machinev1alpha1.PreparedTemplate{Key: testTemplateKey},
		}
		if err := records.SaveSnapshotRecord(context.Background(), record); err != nil {
			t.Fatal(err)
		}
	}
	test := newHarness(t, runtime, records)
	test.disk.usage = pressureUsage
	test.run(t)
	test.store.Apply(1, []*machinev1alpha1.DesiredSnapshot{registrySnapshot(snapshotRef)})

	if err := test.store.collect(context.Background()); err != nil {
		t.Fatalf("collect: %v", err)
	}

	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	if want := []string{imageRemoval + unwantedRef}; !slices.Equal(runtime.removals, want) {
		t.Fatalf("removed %v, want only the image while another snapshot shares the template", runtime.removals)
	}
}
