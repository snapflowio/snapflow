// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package meter

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"sync"
	"time"

	"github.com/snapflowio/snapflow/internal/control"
	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	"github.com/snapflowio/snapflow/internal/state"
	"github.com/snapflowio/snapflow/internal/workload"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	"github.com/snapflowio/tunnel-go/reconnect"
)

const (
	defaultReportInterval  = 30 * time.Second
	maximumParallelSamples = 8
	componentName          = "usage_reporter"
)

type Config struct {
	Interval    time.Duration
	Parallelism int
}

type Dependencies struct {
	Client   *control.Client
	Runtime  sandboxruntime.UsageSampler
	Identity *state.Identity
	Store    ReadingStore
}

type Reporter struct {
	log         *slog.Logger
	now         func() time.Time
	runtime     sandboxruntime.UsageSampler
	identity    *state.Identity
	client      usageAPI
	store       ReadingStore
	interval    time.Duration
	parallelism int
	pending     chan struct{}
	mu          sync.Mutex
	queued      map[string]uint32
}

func New(cfg Config, deps Dependencies, opts ...Option) (*Reporter, error) {
	if deps.Client == nil {
		return nil, errors.New("usage reporter control-plane client is required")
	}
	return newReporter(cfg, deps.Runtime, deps.Identity, deps.Store, &generatedUsageAPI{client: deps.Client}, opts...)
}

func newReporter(
	cfg Config,
	runtime sandboxruntime.UsageSampler,
	identity *state.Identity,
	store ReadingStore,
	client usageAPI,
	opts ...Option,
) (*Reporter, error) {
	if runtime == nil || identity == nil || store == nil || client == nil {
		return nil, errors.New("usage reporter runtime, identity, store, and client are required")
	}
	if err := identity.Validate(); err != nil {
		return nil, fmt.Errorf("validate usage signing identity: %w", err)
	}
	interval := cfg.Interval
	if interval <= 0 {
		interval = defaultReportInterval
	}
	parallelism := cfg.Parallelism
	if parallelism <= 0 {
		parallelism = maximumParallelSamples
	}
	configured := newOptions(opts)
	return &Reporter{
		log:         configured.logger.With(slog.String("component", componentName)),
		now:         configured.clock,
		runtime:     runtime,
		identity:    identity,
		client:      client,
		store:       store,
		interval:    interval,
		parallelism: parallelism,
		pending:     make(chan struct{}, 1),
		queued:      make(map[string]uint32),
	}, nil
}

func (reporter *Reporter) Run(ctx context.Context) error {
	ticker := time.NewTicker(reporter.interval)
	defer ticker.Stop()
	failures := reconnect.DefaultBackoff()
	retry := time.NewTimer(0)
	retry.Stop()
	defer retry.Stop()
	sample := true
	for {
		reporter.readQueued(ctx)
		if reporter.report(ctx, sample) {
			failures.Reset()
		} else {
			retry.Reset(failures.Next())
		}
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			sample = true
		case <-reporter.pending:
			sample = false
		case <-retry.C:
			sample = false
		}
	}
}

func (reporter *Reporter) Flush(ctx context.Context, assignment sandboxruntime.Assignment) {
	if reporter.readLifecycle(ctx, assignment.SandboxID, assignment.Generation) {
		reporter.signal()
	}
}

func (reporter *Reporter) Sample(assignment sandboxruntime.Assignment) {
	reporter.mu.Lock()
	reporter.queued[assignment.SandboxID] = assignment.Generation
	reporter.mu.Unlock()
	reporter.signal()
}

func (reporter *Reporter) readQueued(ctx context.Context) {
	reporter.mu.Lock()
	queued := reporter.queued
	reporter.queued = make(map[string]uint32)
	reporter.mu.Unlock()
	for sandboxID, generation := range queued {
		reporter.readLifecycle(ctx, sandboxID, generation)
	}
}

func (reporter *Reporter) readLifecycle(ctx context.Context, sandboxID string, generation uint32) bool {
	err := reporter.read(ctx, sandboxID, generation)
	if err != nil && ctx.Err() == nil && !workload.IsRuntimeNotFound(err) {
		reporter.log.WarnContext(
			ctx,
			"Failed to take a lifecycle usage reading",
			"sandbox_id", sandboxID,
			"assignment_generation", generation,
			"error", err,
		)
	}
	return err == nil
}

func (reporter *Reporter) signal() {
	select {
	case reporter.pending <- struct{}{}:
	default:
	}
}

func (reporter *Reporter) report(ctx context.Context, sample bool) bool {
	placements, err := reporter.client.ListPlacements(ctx)
	if err != nil {
		if ctx.Err() == nil {
			reporter.log.WarnContext(ctx, "Failed to list placements for usage reporting", "error", err)
		}
		return false
	}
	if sample {
		forEachParallel(ctx, reporter.parallelism, placements, func(placement apiclient.MachineReportablePlacementDto) {
			if err := reporter.readPlacement(ctx, placement); err != nil && ctx.Err() == nil {
				reporter.log.WarnContext(
					ctx,
					"Failed to read sandbox usage",
					"sandbox_id", placement.SandboxId,
					"placement_id", placement.PlacementId,
					"error", err,
				)
			}
		})
	}
	return reporter.deliverPending(ctx, placements)
}

func (reporter *Reporter) readPlacement(ctx context.Context, placement apiclient.MachineReportablePlacementDto) error {
	generation, err := assignmentGeneration(placement.AssignmentGeneration)
	if err != nil {
		return err
	}
	err = reporter.read(ctx, placement.SandboxId, generation)
	if placement.ReleasedAt != nil && workload.IsRuntimeNotFound(err) {
		return nil
	}
	return err
}

func (reporter *Reporter) read(ctx context.Context, sandboxID string, generation uint32) error {
	sample, err := reporter.runtime.RuntimeUsageSample(ctx, sandboxID)
	if err != nil {
		return fmt.Errorf("sample runtime: %w", err)
	}
	return reporter.store.SaveUsageReading(ctx, state.UsageReading{
		SandboxID: sandboxID, AssignmentGeneration: generation, Sample: sample,
	})
}

func assignmentGeneration(generation int) (uint32, error) {
	if generation <= 0 || generation > math.MaxUint32 {
		return 0, fmt.Errorf("assignment generation %d is not positive", generation)
	}
	return uint32(generation), nil
}
