// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package sandbox

import (
	"context"
	"errors"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/snapflowio/snapflow/internal/workload"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const (
	operationEnsured  = "ensure-snapshot"
	operationReleased = "release-snapshot"
	appliedRevision   = 7
)

var errSnapshotUnavailable = errors.New("snapshot is unavailable")

type fakeSnapshots struct {
	runtime  *fakeRuntime
	failWith error
	mu       sync.Mutex
	ensured  []string
	applied  []uint64
	desired  []string
}

func (snapshots *fakeSnapshots) Ensure(ctx context.Context, ref string) (func(), error) {
	snapshots.mu.Lock()
	snapshots.ensured = append(snapshots.ensured, ref)
	snapshots.mu.Unlock()
	snapshots.record(operationEnsured)
	if snapshots.failWith != nil {
		return nil, snapshots.failWith
	}
	return func() { snapshots.record(operationReleased) }, ctx.Err()
}

func (snapshots *fakeSnapshots) Apply(revision uint64, desired []*machinev1alpha1.DesiredSnapshot) {
	snapshots.mu.Lock()
	defer snapshots.mu.Unlock()
	snapshots.applied = append(snapshots.applied, revision)
	snapshots.desired = append(snapshots.desired, desiredRefs(desired)...)
}

func desiredRefs(desired []*machinev1alpha1.DesiredSnapshot) []string {
	refs := make([]string, 0, len(desired))
	for _, snapshot := range desired {
		refs = append(refs, snapshot.GetRef())
	}
	return refs
}

func (snapshots *fakeSnapshots) record(operation string) {
	if snapshots.runtime == nil {
		return
	}
	snapshots.runtime.mu.Lock()
	defer snapshots.runtime.mu.Unlock()
	snapshots.runtime.operations = append(snapshots.runtime.operations, operation)
}

func snapshotConverger(t *testing.T, runtime *fakeRuntime, snapshots *fakeSnapshots) *Converger {
	t.Helper()
	converger, err := NewConverger(
		ConvergerConfig{RuntimeIdentity: testIdentity, ReleaseIdentity: testIdentity},
		ConvergerDependencies{Runtime: runtime, Secrets: &fakeControl{}, Snapshots: snapshots, Meter: fakeMeter{runtime: runtime}, Metrics: testMetrics(t)},
	)
	if err != nil {
		t.Fatalf("NewConverger() error = %v", err)
	}
	return converger
}

func TestMaterializePullsTheSnapshotInsideConvergence(t *testing.T) {
	runtime := newFakeRuntime()
	snapshots := &fakeSnapshots{runtime: runtime}

	record, err := snapshotConverger(t, runtime, snapshots).Converge(
		t.Context(), Target{Desired: desiredSandbox(t, testSandboxID, 1, 1, started)},
	)
	if err != nil {
		t.Fatalf("Converge() error = %v", err)
	}
	if record.FailureReason != "" {
		t.Fatalf("convergence failed: %s", record.FailureReason)
	}
	if !slices.Equal(snapshots.ensured, []string{testImage}) {
		t.Fatalf("ensured %v, want the spec image", snapshots.ensured)
	}
	operations := runtime.recorded()
	ensured := slices.Index(operations, operationEnsured)
	materialized := slices.Index(operations, operationMaterialize)
	released := slices.Index(operations, operationReleased)
	if ensured < 0 || ensured > materialized || released < materialized {
		t.Fatalf("operations = %v, want the snapshot ensured before and released after materializing", operations)
	}
}

func TestMaterializeRecordsAnUnavailableSnapshot(t *testing.T) {
	runtime := newFakeRuntime()
	snapshots := &fakeSnapshots{runtime: runtime, failWith: errSnapshotUnavailable}

	record, err := snapshotConverger(t, runtime, snapshots).Converge(
		t.Context(), Target{Desired: desiredSandbox(t, testSandboxID, 1, 1, started)},
	)
	if err != nil {
		t.Fatalf("Converge() error = %v", err)
	}
	if !strings.Contains(record.FailureReason, errSnapshotUnavailable.Error()) || record.Materialized {
		t.Fatalf("record = %+v, want the snapshot failure recorded", record)
	}
	if slices.Contains(runtime.recorded(), operationMaterialize) {
		t.Fatal("materialized a runtime without its snapshot")
	}
}

func TestMaterializeWaitsForAnUnbuiltLocalSnapshot(t *testing.T) {
	runtime := newFakeRuntime()
	snapshots := &fakeSnapshots{runtime: runtime, failWith: workload.ErrLocalSnapshotNotHeld}

	record, err := snapshotConverger(t, runtime, snapshots).Converge(
		t.Context(), Target{Desired: desiredSandbox(t, testSandboxID, 1, 1, started)},
	)
	if !errors.Is(err, errRetry) || !errors.Is(err, workload.ErrLocalSnapshotNotHeld) {
		t.Fatalf("Converge() error = %v, want a retry until the build finishes", err)
	}
	if record.FailureReason != "" || record.Materialized {
		t.Fatalf("record = %+v, want nothing recorded while the build runs", record)
	}
}

func TestRefreshAppliesTheDesiredSnapshots(t *testing.T) {
	snapshots := &fakeSnapshots{}
	control := &fakeControl{documents: []*apiclient.MachineDesiredStateDocumentDto{
		signedDocument(t, appliedRevision, time.Now().Add(time.Hour)),
	}}
	service := testManager(t, newFakeRuntime(), control, newMemoryRecords())
	service.snapshots = snapshots
	service.workers = newWorkerPool(t.Context(), func(context.Context, work) outcome { return outcomeSettled })
	defer service.workers.stop()

	if err := service.refresh(t.Context()); err != nil {
		t.Fatalf("refresh() error = %v", err)
	}
	snapshots.mu.Lock()
	defer snapshots.mu.Unlock()
	if !slices.Equal(snapshots.applied, []uint64{appliedRevision}) {
		t.Fatalf("applied snapshot sets of revisions %v, want %d", snapshots.applied, appliedRevision)
	}
}
