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
	"encoding/json"
	"path/filepath"
	"testing"

	"github.com/snapflowio/microvm-go/devices"
	"github.com/snapflowio/microvm-go/internal/snapshot"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/layout"
	"github.com/snapflowio/microvm-go/types"
)

func TestValidateForkSourceRequiresQuiescedInstance(t *testing.T) {
	for _, runtimeState := range []types.RuntimeState{
		types.RuntimeStateStarted,
		types.RuntimeStateStopped,
		types.RuntimeStateStandby,
		types.RuntimeStateError,
	} {
		if err := validateForkSource(state.InstanceMetadata{State: runtimeState}); err != nil {
			t.Fatalf("expected state %q to support a storage fork: %v", runtimeState, err)
		}
	}

	for _, runtimeState := range []types.RuntimeState{
		types.RuntimeStatePaused,
		types.RuntimeStateCreating,
	} {
		if err := validateForkSource(state.InstanceMetadata{State: runtimeState}); err == nil {
			t.Fatalf("expected state %q to be rejected", runtimeState)
		}
	}
}

func TestProtectedImageDirsIncludesSnapshotReferences(t *testing.T) {
	paths := layout.NewPaths(t.TempDir())
	store := snapshot.NewStore(paths)
	rootfs := paths.ImageDisk("library/alpine", "deadbeef")
	metadata, err := json.Marshal(state.InstanceMetadata{RootfsDisk: rootfs})
	if err != nil {
		t.Fatal(err)
	}
	if err := store.SaveRecord(snapshot.Record{
		Snapshot:       snapshot.Snapshot{ID: "snapshot-1", SourceInstanceID: "deleted-source"},
		StoredMetadata: metadata,
	}); err != nil {
		t.Fatal(err)
	}

	backend := &Backend{paths: paths, snapshots: store}
	protected, err := backend.protectedImageDirs()
	if err != nil {
		t.Fatal(err)
	}
	if !protected[filepath.Dir(rootfs)] {
		t.Fatalf("snapshot rootfs directory %q was not protected", filepath.Dir(rootfs))
	}
}

func TestProtectedImageDirsIncludesPlatformBundleReferences(t *testing.T) {
	paths := layout.NewPaths(t.TempDir())
	store := snapshot.NewStore(paths)
	bundleDisk := paths.ImageDisk("snapflow/platform-desktop", "feedface")
	metadata, err := json.Marshal(state.InstanceMetadata{
		PlatformBundles: []state.PlatformBundleMetadata{{DiskPath: bundleDisk}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := store.SaveRecord(snapshot.Record{
		Snapshot:       snapshot.Snapshot{ID: "snapshot-platform", SourceInstanceID: "deleted-source"},
		StoredMetadata: metadata,
	}); err != nil {
		t.Fatal(err)
	}

	backend := &Backend{paths: paths, snapshots: store}
	protected, err := backend.protectedImageDirs()
	if err != nil {
		t.Fatal(err)
	}
	if !protected[filepath.Dir(bundleDisk)] {
		t.Fatalf("snapshot platform bundle directory %q was not protected", filepath.Dir(bundleDisk))
	}
}

func TestForkMetadataAndNetworkIdentityAreIndependent(t *testing.T) {
	source := state.InstanceMetadata{
		ID:           "source",
		Identity:     types.RuntimeArtifactIdentity{InstanceID: "source", AssignmentGeneration: 2},
		PID:          42,
		State:        types.RuntimeStateStandby,
		NetworkMeter: state.NetworkMeter{Totals: state.NetworkCounters{InternetEgressBytes: 1024}},
		Network:      testAllocation("source", 2),
		PCIDevices:   []string{"0000:01:00.0"},
		GPUAssignments: []devices.GPUDevice{{
			PCIAddress: "0000:01:00.0",
			IOMMUGroup: 1,
		}},
		RawRequest: types.CreateRequest{
			ID:       "source",
			Identity: types.RuntimeArtifactIdentity{InstanceID: "source"},
		},
		ResolvedImage: "docker.io/library/alpine@sha256:deadbeef",
	}

	forked, err := newForkMetadata(source, types.ForkRequest{ID: "target", AssignmentGeneration: 5})
	if err != nil {
		t.Fatal(err)
	}
	applyNetworkAllocation(&forked, testAllocation("target", 3))

	assertForkIdentityRebound(t, source, forked)
	assertForkStateIsolated(t, source, forked)
}

func assertForkIdentityRebound(t *testing.T, source, forked state.InstanceMetadata) {
	t.Helper()
	if forked.ID != "target" ||
		forked.Identity.InstanceID != "target" ||
		forked.RawRequest.ID != "target" ||
		forked.RawRequest.Identity.InstanceID != "target" {
		t.Fatalf("fork identity was not rewritten: %#v", forked)
	}
	if forked.Identity.AssignmentGeneration != 5 || forked.RawRequest.Identity.AssignmentGeneration != 5 {
		t.Fatalf("fork did not adopt the requested assignment generation: %#v", forked.Identity)
	}
	if forked.Identity.IntentDigest == source.Identity.IntentDigest ||
		forked.Identity.IntentDigest != forked.RawRequest.Identity.IntentDigest {
		t.Fatalf("fork intent digest was not rebound: %#v", forked.Identity)
	}
}

func assertForkStateIsolated(t *testing.T, source, forked state.InstanceMetadata) {
	t.Helper()
	if forked.ForkSourceInstanceID != source.ID {
		t.Fatalf("fork source provenance was not persisted: %#v", forked)
	}
	if forked.State != types.RuntimeStateStopped || forked.PID != 0 {
		t.Fatalf("fork did not start from a clean stopped state: %#v", forked)
	}
	if forked.Network == nil || forked.Network.Namespace == source.Network.Namespace || forked.Network.Slot == source.Network.Slot {
		t.Fatalf("fork inherited source network identity: %#v", forked)
	}
	if forked.NetworkMeter != (state.NetworkMeter{}) || forked.UsageSequence != 0 || forked.RunningMeter != (state.RunningMeter{}) || len(forked.PCIDevices) != 0 || len(forked.GPUAssignments) != 0 {
		t.Fatalf("fork inherited runtime accounting or device assignment: %#v", forked)
	}
}
