// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package routes

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestStoreRejectsVersionAndAssignmentRegression(t *testing.T) {
	t.Parallel()
	fixture := newRouteFixture()
	store, err := OpenStore(t.TempDir(), fixture.edgeID, fixedGeneration(testEdgeSessionGeneration))
	if err != nil {
		t.Fatalf("open route store: %v", err)
	}
	current := fixture.snapshot("2")
	if err := store.Apply(current); err != nil {
		t.Fatalf("apply route snapshot: %v", err)
	}
	regressedVersion := fixture.snapshot("1")
	regressedVersion.GeneratedAt = current.GeneratedAt.Add(time.Second)
	recalculateSnapshotDigest(t, regressedVersion)
	if err := store.Apply(regressedVersion); err == nil {
		t.Fatal("route-table version regression was accepted")
	}
	regressedAssignment := fixture.snapshot("3")
	regressedAssignment.GeneratedAt = current.GeneratedAt.Add(time.Second)
	regressedAssignment.HttpRoutes[0].AssignmentGeneration = 2
	recalculateSnapshotDigest(t, regressedAssignment)
	if err := store.Apply(regressedAssignment); err == nil {
		t.Fatal("assignment-generation regression was accepted")
	}
	replayed := fixture.snapshot("2")
	replayed.HttpRoutes[0].TargetPort++
	recalculateSnapshotDigest(t, replayed)
	if err := store.Apply(replayed); err == nil {
		t.Fatal("same route version with a different digest was accepted")
	}
}

func TestStoreFollowsSessionGenerationAdvance(t *testing.T) {
	t.Parallel()
	fixture := newRouteFixture()
	generation := testEdgeSessionGeneration
	store, err := OpenStore(t.TempDir(), fixture.edgeID, func() int32 { return generation })
	if err != nil {
		t.Fatalf("open route store: %v", err)
	}
	if err := store.Apply(fixture.snapshot("1")); err != nil {
		t.Fatalf("apply first-session snapshot: %v", err)
	}
	generation++
	stale := fixture.snapshot("2")
	if err := store.Apply(stale); !errors.Is(err, ErrPreviousSession) {
		t.Fatalf("previous-session snapshot error = %v", err)
	}
	next := fixture.snapshot("3")
	next.EdgeSessionGeneration = int(generation)
	recalculateSnapshotDigest(t, next)
	if err := store.Apply(next); err != nil {
		t.Fatalf("apply re-established session snapshot: %v", err)
	}
}

func TestStorePersistsAndReloadsOnlyItsSessionSnapshot(t *testing.T) {
	t.Parallel()
	fixture := newRouteFixture()
	directory := t.TempDir()
	store, err := OpenStore(directory, fixture.edgeID, fixedGeneration(testEdgeSessionGeneration))
	if err != nil {
		t.Fatalf("open route store: %v", err)
	}
	if err := store.Apply(fixture.snapshot("1")); err != nil {
		t.Fatalf("apply route snapshot: %v", err)
	}
	reloaded, err := OpenStore(directory, fixture.edgeID, fixedGeneration(testEdgeSessionGeneration))
	if err != nil {
		t.Fatalf("reload route store: %v", err)
	}
	if !reloaded.Ready() || reloaded.Load().Version() != "1" {
		t.Fatal("last-known-good snapshot did not survive restart")
	}
	otherSession, err := OpenStore(directory, fixture.edgeID, fixedGeneration(testEdgeSessionGeneration+1))
	if err != nil {
		t.Fatalf("open store for new session: %v", err)
	}
	if otherSession.Ready() || otherSession.Load().Version() != "" {
		t.Fatal("snapshot from a previous Edge session was reused")
	}
	statePath := filepath.Join(directory, routeTableFilename)
	if _, statErr := os.Stat(statePath); !errors.Is(statErr, os.ErrNotExist) {
		t.Fatalf("previous-session route table was not discarded: %v", statErr)
	}
}
