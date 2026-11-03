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
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/snapflowio/common-go/pkg/apierror"
	"github.com/snapflowio/snapflow/internal/control"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	"github.com/snapflowio/tunnel-go/reconnect"
)

const (
	pollRetryDelay       = 5 * time.Second
	minimumIdlePollDelay = time.Second
	pollOperation        = "poll jobs"
)

type jobExecutor interface {
	Execute(context.Context, *apiclient.Job)
}

type PollerConfig struct {
	Timeout time.Duration
	Limit   int
}

type PollerDependencies struct {
	Client   *control.Client
	Executor jobExecutor
}

type Poller struct {
	log         *slog.Logger
	pollTimeout time.Duration
	pollLimit   int
	executor    jobExecutor
	client      *control.Client
}

func NewPoller(cfg PollerConfig, deps PollerDependencies, opts ...Option) (*Poller, error) {
	if deps.Client == nil || deps.Executor == nil {
		return nil, errors.New("poller control-plane client and executor are required")
	}
	if cfg.Timeout <= 0 || cfg.Timeout > control.LongPollWait {
		return nil, fmt.Errorf("poll timeout must be positive and at most %s", control.LongPollWait)
	}
	if cfg.Limit <= 0 {
		return nil, errors.New("poll limit must be positive")
	}
	return &Poller{
		log:         newOptions(opts).logger.With(slog.String("component", "poller")),
		pollTimeout: cfg.Timeout,
		pollLimit:   cfg.Limit,
		executor:    deps.Executor,
		client:      deps.Client,
	}, nil
}

func (s *Poller) Run(ctx context.Context) error {
	var workers sync.WaitGroup
	defer workers.Wait()
	slots := make(chan struct{}, s.pollLimit)
	dispatch := func(job apiclient.Job) bool {
		select {
		case slots <- struct{}{}:
		case <-ctx.Done():
			return false
		}
		workers.Go(func() {
			defer func() { <-slots }()
			s.executor.Execute(ctx, &job)
		})
		return true
	}

	s.log.InfoContext(ctx, "Starting job poller")
	defer s.log.InfoContext(ctx, "Job poller stopped")
	for ctx.Err() == nil {
		if !s.pollOnce(ctx, dispatch) {
			return nil
		}
	}
	return nil
}

func (s *Poller) pollOnce(ctx context.Context, dispatch func(apiclient.Job) bool) bool {
	pollStartedAt := time.Now()
	jobs, err := s.pollJobs(ctx)
	if err != nil {
		if ctx.Err() != nil {
			return false
		}
		s.log.ErrorContext(ctx, "Failed to poll jobs", "error", err)
		return reconnect.Wait(ctx, pollRetryDelay)
	}
	if len(jobs) > 0 {
		s.log.DebugContext(ctx, "Received jobs", "count", len(jobs))
		for _, job := range jobs {
			if !dispatch(job) {
				return false
			}
		}
		return true
	}
	return waitForMinimumPollCycle(ctx, pollStartedAt, minimumIdlePollDelay)
}

func waitForMinimumPollCycle(
	ctx context.Context,
	startedAt time.Time,
	minimumDuration time.Duration,
) bool {
	remaining := minimumDuration - time.Since(startedAt)
	if remaining <= 0 {
		return true
	}
	return reconnect.Wait(ctx, remaining)
}

func (s *Poller) pollJobs(ctx context.Context) ([]apiclient.Job, error) {
	timeout := float32(s.pollTimeout.Seconds())
	limit := float32(s.pollLimit)
	response, err := s.client.PollJobsWithResponse(ctx, &apiclient.PollJobsParams{Timeout: &timeout, Limit: &limit})
	if err := apierror.CheckResponse(pollOperation, response, err); err != nil {
		if apierror.HasStatus(err, http.StatusRequestTimeout) {
			return nil, nil
		}
		return nil, err
	}
	if response.JSON200 == nil {
		return nil, nil
	}
	return response.JSON200.Jobs, nil
}
