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
	"net/http"
	"slices"
	"testing"
	"time"

	microvmtypes "github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/snapflow/internal/control/controltest"
	"github.com/snapflowio/snapflow/internal/state"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

func authorizedWork(desired *machinev1alpha1.SandboxDesiredState, sandboxID string) work {
	return work{sandboxID: sandboxID, desired: desired, revision: 1, expiresAt: time.Now().Add(testDocumentLife)}
}

func TestSynchronizeNeverRestartsARuntimeThatExitedOnItsOwn(t *testing.T) {
	runtime := newFakeRuntime()
	store := newMemoryRecords()
	service := testManager(t, runtime, &fakeControl{}, store)
	desired := desiredSandbox(t, testSandboxID, 1, 1, started)
	if got := service.synchronize(t.Context(), authorizedWork(desired, testSandboxID)); got != outcomeSettled {
		t.Fatalf("first synchronize = %v", got)
	}
	runtime.host(testSandboxID, 1, microvmtypes.RuntimeStateStopped)
	operations := len(runtime.recorded())
	service.synchronize(t.Context(), authorizedWork(desired, testSandboxID))
	if len(runtime.recorded()) != operations {
		t.Fatalf("an exited runtime was acted on again: %v", runtime.recorded())
	}
	restarted := testManager(t, runtime, &fakeControl{}, store)
	restarted.synchronize(t.Context(), authorizedWork(desired, testSandboxID))
	if len(runtime.recorded()) != operations {
		t.Fatalf("a restarted Machine converged a generation twice: %v", runtime.recorded())
	}
}

func TestSynchronizeRemovesUnlistedRuntimesExceptLocalOnes(t *testing.T) {
	runtime := newFakeRuntime()
	runtime.host(testSandboxID, 1, microvmtypes.RuntimeStateStarted)
	runtime.host(otherSandboxID, 1, microvmtypes.RuntimeStateStarted)
	store := newMemoryRecords()
	store.records[testSandboxID] = state.SandboxConvergence{SandboxID: testSandboxID, AssignmentGeneration: 1, Materialized: true}
	service := testManager(t, runtime, &fakeControl{}, store)
	release := service.local.Hold(otherSandboxID)
	defer release()

	if got := service.synchronize(t.Context(), authorizedWork(nil, testSandboxID)); got != outcomeRemoved {
		t.Fatalf("synchronize() = %v, want outcomeRemoved", got)
	}
	if _, hosted := runtime.state(testSandboxID); hosted {
		t.Fatal("an unlisted runtime was kept")
	}
	if got, want := runtime.recorded(), []string{operationMeter, operationDestroy}; !slices.Equal(got, want) {
		t.Fatalf("operations = %v, want the final usage reading before destruction", got)
	}
	if _, remembered := store.records[testSandboxID]; remembered {
		t.Fatal("an unlisted sandbox was not forgotten")
	}
	service.synchronize(t.Context(), authorizedWork(nil, otherSandboxID))
	if _, hosted := runtime.state(otherSandboxID); !hosted {
		t.Fatal("a local runtime was removed")
	}
}

func TestSynchronizeNeverActsOnAnExpiredOrRejectedDocument(t *testing.T) {
	runtime := newFakeRuntime()
	runtime.host(testSandboxID, 1, microvmtypes.RuntimeStateStarted)
	service := testManager(t, runtime, &fakeControl{}, newMemoryRecords())
	expired := work{sandboxID: testSandboxID, revision: 1, expiresAt: time.Now().Add(-time.Second)}
	service.synchronize(t.Context(), expired)
	service.activity.suppress(otherSandboxID, 1)
	service.synchronize(t.Context(), authorizedWork(desiredSandbox(t, otherSandboxID, 1, 1, started), otherSandboxID))
	if operations := runtime.recorded(); len(operations) != 0 {
		t.Fatalf("the Machine acted without authorization: %v", operations)
	}
	next := authorizedWork(desiredSandbox(t, otherSandboxID, 1, 1, started), otherSandboxID)
	next.revision = 2
	service.synchronize(t.Context(), next)
	if !slices.Contains(runtime.recorded(), operationMaterialize) {
		t.Fatal("a newer document did not lift the verdict")
	}
}

func TestRefreshLongPollsWithTheDigestAndRejectsInvalidDocuments(t *testing.T) {
	expiresAt := time.Now().Add(testDocumentLife)
	valid := signedDocument(t, 2, expiresAt, desiredSandbox(t, testSandboxID, 1, 1, started))
	rollback := signedDocument(t, 1, expiresAt)
	expired := signedDocument(t, 3, time.Now().Add(-time.Second))
	tampered := signedDocument(t, 4, expiresAt)
	tampered.Digest = rollback.Digest
	control := &fakeControl{documents: []*apiclient.MachineDesiredStateDocumentDto{valid, rollback, expired, tampered}}
	service := testManager(t, newFakeRuntime(), control, newMemoryRecords())
	dispatched := make(chan work, 1)
	service.workers = newWorkerPool(t.Context(), func(ctx context.Context, item work) outcome {
		select {
		case dispatched <- item:
		default:
		}
		return outcomeSettled
	})
	defer service.workers.stop()

	if err := service.refresh(t.Context()); err != nil {
		t.Fatalf("refresh() error = %v", err)
	}
	for range 3 {
		var rejected *rejectedDocumentError
		if err := service.refresh(t.Context()); !errors.As(err, &rejected) {
			t.Fatalf("refresh() error = %v, want a rejected document", err)
		}
		if got := service.currentDocument().GetRevision(); got != acceptedRevision {
			t.Fatalf("current revision = %d, want the last valid document", got)
		}
	}
	if err := service.refresh(t.Context()); err != nil {
		t.Fatalf("unchanged refresh() error = %v", err)
	}
	want := []string{"", valid.Digest, rollback.Digest, expired.Digest, tampered.Digest}
	if !slices.Equal(control.digests, want) {
		t.Fatalf("If-None-Match digests = %v, want %v", control.digests, want)
	}
	select {
	case item := <-dispatched:
		if item.sandboxID != testSandboxID || item.desired == nil {
			t.Fatalf("dispatched %+v", item)
		}
	case <-time.After(time.Second):
		t.Fatal("the listed sandbox was not dispatched")
	}
}

func TestWatchStopsOnAPermanentRejectionAndBacksOffTransientFailures(t *testing.T) {
	control := &fakeControl{fetchErr: controltest.StatusError(http.StatusForbidden)}
	service := testManager(t, newFakeRuntime(), control, newMemoryRecords())
	service.workers = newWorkerPool(t.Context(), func(context.Context, work) outcome { return outcomeSettled })
	defer service.workers.stop()
	if err := service.watch(t.Context()); err == nil {
		t.Fatal("a permanent rejection did not stop the watcher")
	}

	control.fetchErr = controltest.StatusError(http.StatusServiceUnavailable)
	ctx, cancel := context.WithTimeout(t.Context(), transientWatchWindow)
	defer cancel()
	if err := service.watch(ctx); err != nil {
		t.Fatalf("watch() error = %v on transient failures", err)
	}
	if reads := len(control.digests); reads < 2 || reads > maximumTransientReads {
		t.Fatalf("watcher read %d times within %s; want a backed-off retry", reads, transientWatchWindow)
	}
}

func TestWatchReadsAgainRightAfterAChangedDocument(t *testing.T) {
	expiresAt := time.Now().Add(time.Hour)
	first := signedDocument(t, 1, expiresAt)
	second := signedDocument(t, acceptedRevision, expiresAt)
	control := &fakeControl{documents: []*apiclient.MachineDesiredStateDocumentDto{first, second}}
	service := testManager(t, newFakeRuntime(), control, newMemoryRecords())
	service.workers = newWorkerPool(t.Context(), func(context.Context, work) outcome { return outcomeSettled })
	defer service.workers.stop()

	ctx, cancel := context.WithTimeout(t.Context(), minimumDesiredStateReadInterval/2)
	defer cancel()
	if err := service.watch(ctx); err != nil {
		t.Fatalf("watch() error = %v", err)
	}
	want := []string{"", first.Digest, second.Digest}
	if !slices.Equal(control.digests, want) {
		t.Fatalf("reads = %v, want each changed document read again at once and an unchanged one paced", control.digests)
	}
}
