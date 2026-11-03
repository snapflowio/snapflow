// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package snapshot

import (
	"context"
	"errors"
	"slices"
	"strings"
	"testing"

	microvmtypes "github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/snapflow/internal/state"
	"github.com/snapflowio/snapflow/internal/workload"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"google.golang.org/protobuf/proto"
)

const (
	snapshotRef  = "registry.example.com/snapflow/base:1.0"
	inUseRef     = "registry.example.com/snapflow/in-use:1.0"
	unwantedRef  = "registry.example.com/snapflow/unwanted:1.0"
	secondaryRef = "registry.example.com/snapflow/secondary:1.0"
	failedPulls  = 2
)

const (
	present = machinev1alpha1.SnapshotInventoryState_SNAPSHOT_INVENTORY_STATE_PRESENT
	failed  = machinev1alpha1.SnapshotInventoryState_SNAPSHOT_INVENTORY_STATE_FAILED
)

func TestEnsurePullsAnAbsentSnapshotOnDemand(t *testing.T) {
	test := newHarness(t, newFakeRuntime(), newFakeRecords())
	test.run(t)
	test.store.Apply(1, []*machinev1alpha1.DesiredSnapshot{registrySnapshot(snapshotRef)})

	release, err := test.store.Ensure(context.Background(), snapshotRef)
	if err != nil {
		t.Fatalf("ensure snapshot: %v", err)
	}
	if got := test.runtime.pullCount(snapshotRef); got != 1 {
		t.Fatalf("pulled %d times, want once", got)
	}
	if got := test.runtime.registries[0].GetUrl(); got != testRegistryURL {
		t.Fatalf("pulled from registry %q, want the desired snapshot registry", got)
	}
	if err := test.store.collect(context.Background()); err != nil {
		t.Fatalf("collect: %v", err)
	}
	test.clock.advance(2 * testGracePeriod)
	test.disk.usage = pressureUsage
	if err := test.store.collect(context.Background()); err != nil {
		t.Fatalf("collect: %v", err)
	}
	if removed := test.runtime.removedRefs(); len(removed) != 0 {
		t.Fatalf("removed %v while a convergence needed it", removed)
	}
	release()
	if state, _ := test.inventoryState(snapshotRef); state != present {
		t.Fatalf("snapshot is %s, want present", state)
	}
}

func TestEnsureReusesAPresentSnapshot(t *testing.T) {
	runtime := newFakeRuntime()
	runtime.hold(snapshotRef)
	records := newFakeRecords()
	if err := records.SaveSnapshotRecord(context.Background(), state.SnapshotRecord{Ref: snapshotRef, Digest: testDigest}); err != nil {
		t.Fatal(err)
	}
	test := newHarness(t, runtime, records)
	test.run(t)

	release, err := test.store.Ensure(context.Background(), snapshotRef)
	if err != nil {
		t.Fatalf("ensure snapshot: %v", err)
	}
	defer release()
	if got := runtime.pullCount(snapshotRef); got != 0 {
		t.Fatalf("pulled a held snapshot %d times", got)
	}
}

func TestDesiredSnapshotPullFailureIsRetriedWithBackoff(t *testing.T) {
	runtime := newFakeRuntime()
	runtime.failPulls = failedPulls
	test := newHarness(t, runtime, newFakeRecords())
	test.run(t)

	test.store.Apply(1, []*machinev1alpha1.DesiredSnapshot{registrySnapshot(snapshotRef)})

	eventually(t, "the failed pull is reported", func() bool {
		return test.control.everReported(snapshotRef, failed)
	})
	eventually(t, "the snapshot is present", func() bool {
		test.clock.advance(testBackoffMaximum)
		test.store.signal()
		state, _ := test.inventoryState(snapshotRef)
		return state == present
	})
	if got := runtime.pullCount(snapshotRef); got != failedPulls+1 {
		t.Fatalf("pulled %d times, want %d", got, failedPulls+1)
	}
	if !test.records.has(snapshotRef) {
		t.Fatal("the present snapshot was not recorded")
	}
	if got := runtime.registries[0].GetPassword(); got != "secret" {
		t.Fatalf("pulled with password %q, want the delivered registry credentials", got)
	}
}

func TestDigestMismatchFailsAndRemovesTheImage(t *testing.T) {
	runtime := newFakeRuntime()
	runtime.digests[snapshotRef] = otherDigest
	test := newHarness(t, runtime, newFakeRecords())
	test.run(t)
	desired := registrySnapshot(snapshotRef)
	desired.Digest = proto.String(testDigest)

	test.store.Apply(1, []*machinev1alpha1.DesiredSnapshot{desired})

	eventually(t, "the mismatching snapshot fails", func() bool {
		state, observed := test.inventoryState(snapshotRef)
		return state == failed && strings.Contains(observed.GetErrorReason(), otherDigest)
	})
	if !slices.Contains(runtime.removedRefs(), snapshotRef) {
		t.Fatal("the mismatching image was not removed")
	}
	if test.records.has(snapshotRef) {
		t.Fatal("the mismatching snapshot was recorded as present")
	}
}

func TestGarbageCollectionUnderDiskPressureKeepsSnapshotsInUse(t *testing.T) {
	runtime := newFakeRuntime()
	records := newFakeRecords()
	for _, ref := range []string{snapshotRef, inUseRef, unwantedRef} {
		runtime.hold(ref)
		if err := records.SaveSnapshotRecord(context.Background(), state.SnapshotRecord{Ref: ref, Digest: testDigest}); err != nil {
			t.Fatal(err)
		}
	}
	runtime.inventory = []microvmtypes.RuntimeObservation{{ID: "sandbox", Image: inUseRef}}
	test := newHarness(t, runtime, records)
	test.run(t)
	test.store.Apply(1, []*machinev1alpha1.DesiredSnapshot{registrySnapshot(snapshotRef)})

	if err := test.store.collect(context.Background()); err != nil {
		t.Fatalf("collect: %v", err)
	}
	if removed := runtime.removedRefs(); len(removed) != 0 {
		t.Fatalf("removed %v within the grace period without disk pressure", removed)
	}

	test.disk.usage = pressureUsage
	if err := test.store.collect(context.Background()); err != nil {
		t.Fatalf("collect: %v", err)
	}
	if removed := runtime.removedRefs(); !slices.Equal(removed, []string{unwantedRef}) {
		t.Fatalf("removed %v under disk pressure, want only %s", removed, unwantedRef)
	}
	for _, ref := range []string{snapshotRef, inUseRef} {
		if state, _ := test.inventoryState(ref); state != present {
			t.Fatalf("%s is %s, want present", ref, state)
		}
	}
}

func TestGarbageCollectionRemovesUnwantedSnapshotsAfterTheGracePeriod(t *testing.T) {
	runtime := newFakeRuntime()
	records := newFakeRecords()
	runtime.hold(unwantedRef)
	if err := records.SaveSnapshotRecord(context.Background(), state.SnapshotRecord{Ref: unwantedRef, Digest: testDigest}); err != nil {
		t.Fatal(err)
	}
	test := newHarness(t, runtime, records)
	test.run(t)
	if err := test.store.collect(context.Background()); err != nil {
		t.Fatalf("collect: %v", err)
	}
	if removed := runtime.removedRefs(); len(removed) != 0 {
		t.Fatalf("removed %v before the first desired state", removed)
	}
	test.store.Apply(1, nil)
	if err := test.store.collect(context.Background()); err != nil {
		t.Fatalf("collect: %v", err)
	}

	test.clock.advance(testGracePeriod)
	if err := test.store.collect(context.Background()); err != nil {
		t.Fatalf("collect: %v", err)
	}

	if removed := runtime.removedRefs(); !slices.Equal(removed, []string{unwantedRef}) {
		t.Fatalf("removed %v after the grace period, want %s", removed, unwantedRef)
	}
	if records.has(unwantedRef) {
		t.Fatal("the removed snapshot is still recorded")
	}
}

func TestRestartMidPullPullsAgain(t *testing.T) {
	runtime := newFakeRuntime()
	runtime.blockPulls = make(chan struct{})
	records := newFakeRecords()
	interrupted := newHarness(t, runtime, records)
	stop := interrupted.run(t)
	interrupted.store.Apply(1, []*machinev1alpha1.DesiredSnapshot{registrySnapshot(snapshotRef)})
	<-runtime.pullStarted
	stop()
	if records.has(snapshotRef) {
		t.Fatal("an interrupted pull was recorded as present")
	}

	runtime.mu.Lock()
	runtime.blockPulls = nil
	runtime.mu.Unlock()
	restarted := newHarness(t, runtime, records)
	restarted.run(t)
	restarted.store.Apply(1, []*machinev1alpha1.DesiredSnapshot{registrySnapshot(snapshotRef)})

	eventually(t, "the restarted store holds the snapshot", func() bool {
		state, _ := restarted.inventoryState(snapshotRef)
		return state == present
	})
	if got := runtime.pullCount(snapshotRef); got != 2 {
		t.Fatalf("pulled %d times, want the interrupted pull and one more", got)
	}
}

func TestTemplateIsPreparedForADesiredSnapshot(t *testing.T) {
	runtime := newFakeRuntime()
	test := newHarness(t, runtime, newFakeRecords())
	test.run(t)
	desired := registrySnapshot(snapshotRef)
	desired.Template = &machinev1alpha1.TemplatePreparation{CpuQuota: 1, MemoryQuota: 2, StorageQuota: 5}

	test.store.Apply(1, []*machinev1alpha1.DesiredSnapshot{desired, registrySnapshot(secondaryRef)})

	eventually(t, "the prepared template is reported", func() bool {
		_, observed := test.inventoryState(snapshotRef)
		return observed.GetTemplate().GetKey() == testTemplateKey
	})
	runtime.mu.Lock()
	defer runtime.mu.Unlock()
	if !slices.Equal(runtime.templates, []string{snapshotRef}) {
		t.Fatalf("prepared templates of %v, want only %s", runtime.templates, snapshotRef)
	}
	if got := runtime.preparations[0].GetMemoryQuota(); got != desired.GetTemplate().GetMemoryQuota() {
		t.Fatalf("prepared a template with %d GiB memory, want %d", got, desired.GetTemplate().GetMemoryQuota())
	}
}

func TestLocalSnapshotsAreRetainedNeverPulled(t *testing.T) {
	runtime := newFakeRuntime()
	test := newHarness(t, runtime, newFakeRecords())
	test.run(t)

	test.store.Apply(1, []*machinev1alpha1.DesiredSnapshot{{
		Ref: snapshotRef, Source: &machinev1alpha1.DesiredSnapshot_Local{Local: &machinev1alpha1.SnapshotLocalSource{}},
	}})
	runtime.hold(snapshotRef)
	if err := test.store.Adopt(context.Background(), snapshotRef); err != nil {
		t.Fatalf("adopt snapshot: %v", err)
	}

	if state, _ := test.inventoryState(snapshotRef); state != present {
		t.Fatalf("adopted snapshot is %s, want present", state)
	}
	if got := runtime.pullCount(snapshotRef); got != 0 {
		t.Fatalf("pulled a local snapshot %d times", got)
	}
}

func TestEnsureNeverPullsALocalSnapshotItDoesNotHold(t *testing.T) {
	runtime := newFakeRuntime()
	test := newHarness(t, runtime, newFakeRecords())
	test.run(t)
	test.store.Apply(1, []*machinev1alpha1.DesiredSnapshot{{
		Ref: snapshotRef, Source: &machinev1alpha1.DesiredSnapshot_Local{Local: &machinev1alpha1.SnapshotLocalSource{}},
	}})

	if _, err := test.store.Ensure(context.Background(), snapshotRef); !errors.Is(err, workload.ErrLocalSnapshotNotHeld) {
		t.Fatalf("ensure an unbuilt local snapshot: %v, want ErrLocalSnapshotNotHeld", err)
	}
	if got := runtime.pullCount(snapshotRef); got != 0 {
		t.Fatalf("pulled a local snapshot %d times", got)
	}

	runtime.hold(snapshotRef)
	if err := test.store.Adopt(context.Background(), snapshotRef); err != nil {
		t.Fatalf("adopt snapshot: %v", err)
	}
	release, err := test.store.Ensure(context.Background(), snapshotRef)
	if err != nil {
		t.Fatalf("ensure the built local snapshot: %v", err)
	}
	release()
}
