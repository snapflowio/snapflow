// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package jobs

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/snapflowio/snapflow/internal/control"
	"github.com/snapflowio/snapflow/internal/control/controltest"
	"github.com/snapflowio/snapflow/internal/state"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

func testLeaseToken() uuid.UUID {
	return uuid.MustParse("6f1c2a4e-9b3d-4c8e-8a71-2d5f0e9b4c13")
}

const (
	testJobID        = "job-1"
	testAttempt      = 1
	testMaxAttempts  = 3
	testCreatedAt    = "2026-01-01T00:00:00Z"
	testResourceType = "sandbox"
	testResourceID   = "sandbox-1"
	testIdentity     = "sha256:1111111111111111111111111111111111111111111111111111111111111111"
	unknownJobType   = apiclient.JobType("not_a_job_type")
	jobStatusAPI     = controltest.APIPrefix + "/jobs/" + testJobID + "/status"
	jobLeaseAPI      = controltest.APIPrefix + "/jobs/" + testJobID + "/lease"
	testLeasePace    = 5 * time.Millisecond
	testWaitDeadline = 5 * time.Second
)

type memoryResults struct {
	mu      sync.Mutex
	results map[string]state.JobResult
}

func newMemoryResults() *memoryResults {
	return &memoryResults{results: make(map[string]state.JobResult)}
}

func (store *memoryResults) SaveJobResult(ctx context.Context, result state.JobResult) error {
	store.mu.Lock()
	defer store.mu.Unlock()
	store.results[result.JobID] = result
	return ctx.Err()
}

func (store *memoryResults) DeleteJobResult(ctx context.Context, result state.JobResult) error {
	store.mu.Lock()
	defer store.mu.Unlock()
	if current, found := store.results[result.JobID]; found && current.Matches(result.Update.LeaseToken, result.Update.Attempt) {
		delete(store.results, result.JobID)
	}
	return ctx.Err()
}

func (store *memoryResults) LoadJobResult(ctx context.Context, jobID string) (state.JobResult, bool, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	result, found := store.results[jobID]
	return result, found, ctx.Err()
}

func (store *memoryResults) LoadJobResults(ctx context.Context) ([]state.JobResult, []state.DeadLetter, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	results := make([]state.JobResult, 0, len(store.results))
	for _, result := range store.results {
		results = append(results, result)
	}
	return results, nil, ctx.Err()
}

func (store *memoryResults) count() int {
	store.mu.Lock()
	defer store.mu.Unlock()
	return len(store.results)
}

func testJob(jobType apiclient.JobType) *apiclient.Job {
	leaseToken := testLeaseToken()
	return &apiclient.Job{
		Id: testJobID, Type: jobType, Status: apiclient.JobStatusInProgress, ResourceType: testResourceType,
		ResourceId: testResourceID, Attempt: testAttempt, MaxAttempts: testMaxAttempts, CreatedAt: testCreatedAt,
		LeaseToken: &leaseToken,
	}
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func testExecutor(t *testing.T, client *control.Client, store ResultStore) *Executor {
	t.Helper()
	outbox, err := NewOutbox(client, store, WithLogger(testLogger()))
	if err != nil {
		t.Fatalf("NewOutbox() error = %v", err)
	}
	return &Executor{
		log:             testLogger(),
		client:          client,
		outbox:          outbox,
		runtimeIdentity: testIdentity,
		releaseIdentity: testIdentity,
		inFlight:        make(map[string]*execution),
		lease:           leaseTiming{renewal: testLeasePace, retry: testLeasePace},
	}
}

func statusHandler(t *testing.T, statusCode int, reported *atomic.Int32) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != jobStatusAPI {
			t.Errorf("unexpected request path %q", request.URL.Path)
		}
		reported.Add(1)
		controltest.WriteJSON(t, writer, statusCode, testJob(unknownJobType))
	}
}

func TestExecuteReportsUnknownJobTypeAsFailed(t *testing.T) {
	var reported apiclient.UpdateJobStatus
	client := controltest.NewClient(t, http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		controltest.DecodeJSON(t, request, &reported)
		controltest.WriteJSON(t, writer, http.StatusOK, testJob(unknownJobType))
	}))
	store := newMemoryResults()
	testExecutor(t, client, store).Execute(t.Context(), testJob(unknownJobType))
	if reported.Status != apiclient.JobStatusFailed || reported.LeaseToken != testLeaseToken() {
		t.Fatalf("reported status = %+v", reported)
	}
	if !strings.Contains(optionalText(reported.ErrorMessage), "unknown job type") {
		t.Fatalf("reported error = %q", optionalText(reported.ErrorMessage))
	}
	if reported.ExecutionResult.RuntimeIdentity != testIdentity {
		t.Fatalf("reported runtime identity = %q", reported.ExecutionResult.RuntimeIdentity)
	}
	if store.count() != 0 {
		t.Fatal("an accepted result was kept in the outbox")
	}
}

func TestExecuteRefusesJobWithoutLease(t *testing.T) {
	var requests atomic.Int32
	client := controltest.NewClient(t, statusHandler(t, http.StatusInternalServerError, &requests))
	job := testJob(unknownJobType)
	job.LeaseToken = nil
	testExecutor(t, client, newMemoryResults()).Execute(t.Context(), job)
	if got := requests.Load(); got != 0 {
		t.Fatalf("executor sent %d requests for an unleased job", got)
	}
}

func TestExecuteSkipsJobsAlreadyFinishedOrRunning(t *testing.T) {
	var requests atomic.Int32
	client := controltest.NewClient(t, statusHandler(t, http.StatusOK, &requests))
	store := newMemoryResults()
	executor := testExecutor(t, client, store)
	job := testJob(unknownJobType)
	finished, err := executor.jobResult(job, nil, nil, time.Second)
	if err != nil {
		t.Fatalf("jobResult() error = %v", err)
	}
	if err := store.SaveJobResult(t.Context(), finished); err != nil {
		t.Fatalf("seed finished result: %v", err)
	}
	executor.Execute(t.Context(), job)
	if requests.Load() != 0 {
		t.Fatal("a finished job was executed again")
	}
	if err := store.DeleteJobResult(t.Context(), finished); err != nil {
		t.Fatalf("clear finished result: %v", err)
	}
	if claimContext, claimed, found := executor.claim(t.Context(), job); !found || claimed == nil || claimContext == nil {
		t.Fatal("claim of an idle job failed")
	}
	executor.Execute(t.Context(), job)
	if requests.Load() != 0 {
		t.Fatal("a running job was executed twice")
	}
}

func TestNewerAttemptSupersedesTheRunningAttempt(t *testing.T) {
	executor := testExecutor(t, controltest.NewClient(t, http.NotFoundHandler()), newMemoryResults())
	stale := testJob(unknownJobType)
	staleContext, staleExecution, found := executor.claim(t.Context(), stale)
	if !found {
		t.Fatal("claim of the first attempt failed")
	}
	newer := testJob(unknownJobType)
	newer.Attempt = testAttempt + 1
	claimedNewer := make(chan bool, 1)
	go func() {
		newerContext, newerExecution, newerFound := executor.claim(t.Context(), newer)
		if newerFound {
			defer executor.release(newer.Id, newerExecution)
			if newerContext.Err() != nil {
				t.Error("the newer attempt started canceled")
			}
		}
		claimedNewer <- newerFound
	}()
	select {
	case <-staleContext.Done():
	case <-time.After(testWaitDeadline):
		t.Fatal("the superseded attempt was not canceled")
	}
	if !errors.Is(context.Cause(staleContext), errLeaseLost) {
		t.Fatalf("superseded attempt cause = %v, want a lost lease", context.Cause(staleContext))
	}
	select {
	case <-claimedNewer:
		t.Fatal("the newer attempt ran before the superseded attempt finished")
	default:
	}
	executor.release(stale.Id, staleExecution)
	if !<-claimedNewer {
		t.Fatal("the newer attempt was refused")
	}
}

func TestOlderAttemptDoesNotSupersedeTheRunningAttempt(t *testing.T) {
	executor := testExecutor(t, controltest.NewClient(t, http.NotFoundHandler()), newMemoryResults())
	current := testJob(unknownJobType)
	current.Attempt = testAttempt + 1
	currentContext, currentExecution, found := executor.claim(t.Context(), current)
	if !found {
		t.Fatal("claim of the current attempt failed")
	}
	defer executor.release(current.Id, currentExecution)
	if olderContext, older, olderFound := executor.claim(t.Context(), testJob(unknownJobType)); olderFound || older != nil || olderContext != nil {
		t.Fatal("an older attempt was admitted")
	}
	if currentContext.Err() != nil {
		t.Fatal("an older attempt canceled the running attempt")
	}
}

func TestAbandonedAttemptsReportNothing(t *testing.T) {
	stopped, stop := context.WithCancel(t.Context())
	stop()
	tests := map[string]struct {
		ctx       context.Context
		err       error
		abandoned bool
	}{
		"succeeded":        {ctx: t.Context(), err: nil, abandoned: false},
		"failed":           {ctx: t.Context(), err: errors.New("failed"), abandoned: false},
		"lease lost":       {ctx: t.Context(), err: errors.Join(errors.New("canceled"), errLeaseLost), abandoned: true},
		"machine shutdown": {ctx: stopped, err: context.Canceled, abandoned: true},
		"done at shutdown": {ctx: stopped, err: nil, abandoned: false},
	}
	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			if abandoned := abandonedAttempt(test.ctx, test.err) != ""; abandoned != test.abandoned {
				t.Fatalf("abandoned = %v, want %v", abandoned, test.abandoned)
			}
		})
	}
}

func TestOutboxKeepsResultsWhileTheSessionIsRejected(t *testing.T) {
	var requests atomic.Int32
	client := controltest.NewClient(t, statusHandler(t, http.StatusUnauthorized, &requests))
	store := newMemoryResults()
	testExecutor(t, client, store).Execute(t.Context(), testJob(unknownJobType))
	if requests.Load() != 1 || store.count() != 1 {
		t.Fatalf("requests = %d, pending = %d; want one rejected delivery and the result kept", requests.Load(), store.count())
	}
}

func TestOutboxKeepsUndeliveredResultsAndResendsThem(t *testing.T) {
	var failing atomic.Bool
	failing.Store(true)
	var requests atomic.Int32
	client := controltest.NewClient(t, http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requests.Add(1)
		statusCode := http.StatusOK
		if failing.Load() {
			statusCode = http.StatusServiceUnavailable
		}
		controltest.WriteJSON(t, writer, statusCode, testJob(unknownJobType))
	}))
	store := newMemoryResults()
	executor := testExecutor(t, client, store)
	executor.Execute(t.Context(), testJob(unknownJobType))
	if store.count() != 1 {
		t.Fatal("an undelivered result was not kept")
	}
	failing.Store(false)
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- executor.outbox.Run(ctx) }()
	deadline := time.Now().Add(testWaitDeadline)
	for store.count() != 0 {
		if time.Now().After(deadline) {
			t.Fatal("the pending result was not resent")
		}
		time.Sleep(testLeasePace)
	}
	cancel()
	if err := <-done; err != nil {
		t.Fatalf("Run() error = %v", err)
	}
}

func TestOutboxDropsResultsTheControlPlaneRefuses(t *testing.T) {
	var requests atomic.Int32
	client := controltest.NewClient(t, statusHandler(t, http.StatusConflict, &requests))
	store := newMemoryResults()
	testExecutor(t, client, store).Execute(t.Context(), testJob(unknownJobType))
	if requests.Load() != 1 || store.count() != 0 {
		t.Fatalf("requests = %d, pending = %d; want one refused delivery and nothing pending", requests.Load(), store.count())
	}
}

func TestLeaseRenewalCancelsOnlyOnAnExplicitRejection(t *testing.T) {
	tests := map[string]struct {
		statusCode int
		canceled   bool
	}{
		"stale lease":        {statusCode: http.StatusConflict, canceled: true},
		"control plane down": {statusCode: http.StatusBadGateway, canceled: false},
		"session rejected":   {statusCode: http.StatusUnauthorized, canceled: false},
	}
	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			var requests atomic.Int32
			client := controltest.NewClient(t, http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
				if request.URL.Path != jobLeaseAPI {
					t.Errorf("unexpected request path %q", request.URL.Path)
				}
				requests.Add(1)
				writer.WriteHeader(test.statusCode)
			}))
			executor := testExecutor(t, client, newMemoryResults())
			ctx, cancel := context.WithCancelCause(t.Context())
			defer cancel(nil)
			done := make(chan struct{})
			go func() {
				defer close(done)
				executor.maintainLease(ctx, testJob(unknownJobType), cancel)
			}()
			deadline := time.Now().Add(testWaitDeadline)
			for requests.Load() < 3 && ctx.Err() == nil && time.Now().Before(deadline) {
				time.Sleep(testLeasePace)
			}
			if canceled := errors.Is(context.Cause(ctx), errLeaseLost); canceled != test.canceled {
				t.Fatalf("operation canceled = %v, want %v", canceled, test.canceled)
			}
			cancel(nil)
			<-done
		})
	}
}

func optionalText(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
