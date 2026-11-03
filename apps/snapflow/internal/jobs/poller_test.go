// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package jobs

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/snapflowio/snapflow/internal/control"
	"github.com/snapflowio/snapflow/internal/control/controltest"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	pollAPI         = controltest.APIPrefix + "/jobs/poll"
	testPollTimeout = time.Second
	testPollLimit   = 2
	testJobAttempt  = 1
)

type recordingExecutor struct {
	mu                sync.Mutex
	executed          []string
	canceledOnRelease bool
	release           chan struct{}
	started           chan struct{}
}

func (executor *recordingExecutor) Execute(ctx context.Context, job *apiclient.Job) {
	executor.mu.Lock()
	executor.executed = append(executor.executed, job.Id)
	executor.mu.Unlock()
	executor.started <- struct{}{}
	<-executor.release
	executor.mu.Lock()
	executor.canceledOnRelease = ctx.Err() != nil
	executor.mu.Unlock()
}

func newTestPoller(t *testing.T, handler http.HandlerFunc, executor jobExecutor) *Poller {
	t.Helper()
	service, err := NewPoller(
		PollerConfig{Timeout: testPollTimeout, Limit: testPollLimit},
		PollerDependencies{Client: controltest.NewClient(t, handler), Executor: executor},
		WithLogger(slog.New(slog.NewTextHandler(io.Discard, nil))),
	)
	if err != nil {
		t.Fatalf("NewPoller() error = %v", err)
	}
	return service
}

func TestPollJobsTreatsRequestTimeoutAsEmpty(t *testing.T) {
	service := newTestPoller(t, func(writer http.ResponseWriter, request *http.Request) {
		writer.WriteHeader(http.StatusRequestTimeout)
	}, &recordingExecutor{})
	jobs, err := service.pollJobs(t.Context())
	if err != nil || len(jobs) != 0 {
		t.Fatalf("pollJobs() = %v, %v; want no jobs and no error", jobs, err)
	}
}

func TestRunWaitsForInFlightJobsAfterCancellation(t *testing.T) {
	executor := &recordingExecutor{release: make(chan struct{}), started: make(chan struct{}, 1)}
	served := false
	service := newTestPoller(t, func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != pollAPI {
			t.Errorf("unexpected request path %q", request.URL.Path)
		}
		jobs := []apiclient.Job{}
		if !served {
			served = true
			jobs = append(jobs, apiclient.Job{
				Id: "job-1", Type: apiclient.JobTypeDeleteVolume, Status: apiclient.JobStatusInProgress, ResourceType: apiclient.JobResourceTypeVolume,
				ResourceId: "volume-1", Attempt: testJobAttempt, MaxAttempts: testMaxAttempts, CreatedAt: testCreatedAt,
			})
		}
		controltest.WriteJSON(t, writer, http.StatusOK, apiclient.PollJobsResponse{Jobs: jobs})
	}, executor)
	ctx, cancel := context.WithCancel(t.Context())
	done := make(chan error, 1)
	go func() { done <- service.Run(ctx) }()
	select {
	case <-executor.started:
	case <-time.After(testWaitDeadline):
		t.Fatal("poller did not dispatch the job")
	}
	cancel()
	select {
	case err := <-done:
		t.Fatalf("Run returned (error = %v) before the in-flight job finished", err)
	case <-time.After(testPollTimeout / 10):
	}
	close(executor.release)
	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("Run() error = %v", err)
		}
	case <-time.After(testWaitDeadline):
		t.Fatal("Run did not return after the job finished")
	}
	if len(executor.executed) != 1 || executor.executed[0] != "job-1" {
		t.Fatalf("executed jobs = %v", executor.executed)
	}
	if !executor.canceledOnRelease {
		t.Fatal("in-flight job context was not canceled at shutdown")
	}
}

func TestNewPollerKeepsTheWaitWithinTheLongPollBudget(t *testing.T) {
	dependencies := PollerDependencies{
		Client:   controltest.NewClient(t, http.HandlerFunc(func(http.ResponseWriter, *http.Request) {})),
		Executor: &recordingExecutor{},
	}
	if _, err := NewPoller(PollerConfig{Timeout: control.LongPollWait, Limit: testPollLimit}, dependencies); err != nil {
		t.Fatalf("NewPoller() rejected the shared long-poll wait: %v", err)
	}
	if _, err := NewPoller(PollerConfig{Timeout: control.LongPollWait + time.Second, Limit: testPollLimit}, dependencies); err == nil {
		t.Fatal("NewPoller() accepted a wait beyond the shared long-poll budget")
	}
}
