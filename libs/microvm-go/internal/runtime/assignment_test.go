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
	"testing"

	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/layout"
	"github.com/snapflowio/microvm-go/types"
)

const assignmentTestInstanceID = "00000000-0000-4000-8000-000000000021"

func writeAssignmentTestInstance(t *testing.T, paths layout.Paths, generation int) {
	t.Helper()
	identity := types.RuntimeArtifactIdentity{InstanceID: assignmentTestInstanceID, AssignmentGeneration: generation}
	if err := state.WriteInstanceMetadata(paths, state.InstanceMetadata{
		ID:         assignmentTestInstanceID,
		State:      types.RuntimeStateStopped,
		Identity:   identity,
		RawRequest: types.CreateRequest{ID: assignmentTestInstanceID, Identity: identity},
	}); err != nil {
		t.Fatal(err)
	}
}

func persistedAssignmentGeneration(t *testing.T, paths layout.Paths) int {
	t.Helper()
	metadata, err := state.ReadInstanceMetadata(paths, assignmentTestInstanceID)
	if err != nil {
		t.Fatal(err)
	}
	if metadata.Identity.AssignmentGeneration != metadata.RawRequest.Identity.AssignmentGeneration {
		t.Fatalf("identity generation %d diverged from request generation %d",
			metadata.Identity.AssignmentGeneration, metadata.RawRequest.Identity.AssignmentGeneration)
	}
	return metadata.Identity.AssignmentGeneration
}

func TestAdmitAssignmentGenerationPersistsNewerAndRejectsStale(t *testing.T) {
	paths := layout.NewPaths(t.TempDir())
	backend := &Backend{paths: paths}
	writeAssignmentTestInstance(t, paths, 3)

	metadata, err := state.ReadInstanceMetadata(paths, assignmentTestInstanceID)
	if err != nil {
		t.Fatal(err)
	}
	if err := backend.admitAssignmentGeneration(&metadata, unassertedAssignmentGeneration); err != nil {
		t.Fatalf("unasserted generation was rejected: %v", err)
	}
	if err := backend.admitAssignmentGeneration(&metadata, 4); err != nil {
		t.Fatalf("newer generation was rejected: %v", err)
	}
	if got := persistedAssignmentGeneration(t, paths); got != 4 {
		t.Fatalf("persisted generation = %d, want 4", got)
	}
	if err := backend.admitAssignmentGeneration(&metadata, 3); !errors.Is(err, ErrStaleAssignment) {
		t.Fatalf("stale generation error = %v, want ErrStaleAssignment", err)
	}
	if err := backend.admitAssignmentGeneration(&metadata, -1); err == nil {
		t.Fatal("negative generation was accepted")
	}
}

func TestStopRejectsStaleAssignmentBeforeMutating(t *testing.T) {
	paths := layout.NewPaths(t.TempDir())
	backend := &Backend{paths: paths, lifecycle: lifecycle.NewCoordinator()}
	writeAssignmentTestInstance(t, paths, 7)

	err := backend.stopLockedWithOptions(context.Background(), assignmentTestInstanceID, types.StopOptions{AssignmentGeneration: 6})
	if !errors.Is(err, ErrStaleAssignment) {
		t.Fatalf("stop error = %v, want ErrStaleAssignment", err)
	}
	if got := persistedAssignmentGeneration(t, paths); got != 7 {
		t.Fatalf("persisted generation = %d, want 7", got)
	}
}

func TestAdmitAssignmentAdoptsNewerAndRejectsStaleOrMissing(t *testing.T) {
	paths := layout.NewPaths(t.TempDir())
	backend := &Backend{paths: paths, lifecycle: lifecycle.NewCoordinator()}
	writeAssignmentTestInstance(t, paths, 2)

	if err := backend.AdmitAssignment(context.Background(), assignmentTestInstanceID, 2); err != nil {
		t.Fatalf("current generation was rejected: %v", err)
	}
	if err := backend.AdmitAssignment(context.Background(), assignmentTestInstanceID, 5); err != nil {
		t.Fatalf("newer generation was rejected: %v", err)
	}
	if got := persistedAssignmentGeneration(t, paths); got != 5 {
		t.Fatalf("persisted generation = %d, want 5", got)
	}
	if err := backend.AdmitAssignment(context.Background(), assignmentTestInstanceID, 4); !errors.Is(err, ErrStaleAssignment) {
		t.Fatalf("stale generation error = %v, want ErrStaleAssignment", err)
	}
	if err := backend.AdmitAssignment(context.Background(), assignmentTestInstanceID, unassertedAssignmentGeneration); err == nil {
		t.Fatal("an unasserted generation was admitted")
	}
	if err := backend.AdmitAssignment(context.Background(), "00000000-0000-4000-8000-000000000022", 1); err == nil {
		t.Fatal("a missing instance was admitted")
	}
}
