// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package control

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"sync/atomic"
	"time"

	"github.com/snapflowio/edge/internal/availability"
)

const (
	localFailureGrace          = 15 * time.Second
	routeAvailabilityService   = "edge route table"
	hostAvailabilityService    = "edge host telemetry"
	controlLoopCount           = 2
	routeControlOperation      = "refresh edge routes"
	heartbeatControlOperation  = "report edge heartbeat"
	routeApplicationOperation  = "apply route table"
	hostSamplingOperation      = "sample host capacity"
	finalHeartbeatFailureEvent = "final edge heartbeat failed"
)

type Coordinator struct {
	logger               *slog.Logger
	control              API
	routes               RouteStore
	status               Status
	host                 HostSampler
	startedAt            time.Time
	version              string
	placementConstraint  placementConstraintDetector
	placementConstrained atomic.Bool
	accepting            atomic.Bool
	heartbeatMu          sync.Mutex
	routeAvailability    *availability.Monitor
	hostAvailability     *availability.Monitor
	heartbeatRequests    chan struct{}
}

func NewCoordinator(
	control API,
	routes RouteStore,
	status Status,
	host HostSampler,
	version string,
	opts ...Option,
) (*Coordinator, error) {
	if control == nil || routes == nil || status == nil || version == "" ||
		host == nil {
		return nil, errors.New(
			"edge coordinator requires control, routes, status, version, and host metrics",
		)
	}
	routeAvailability, err := availability.NewMonitor(
		routeAvailabilityService,
		localFailureGrace,
	)
	if err != nil {
		return nil, fmt.Errorf("initialize route availability monitor: %w", err)
	}
	hostAvailability, err := availability.NewMonitor(
		hostAvailabilityService,
		localFailureGrace,
	)
	if err != nil {
		return nil, fmt.Errorf("initialize host availability monitor: %w", err)
	}
	result := &Coordinator{
		logger:            newOptions(opts).logger,
		control:           control,
		routes:            routes,
		status:            status,
		host:              host,
		startedAt:         time.Now().UTC(),
		version:           version,
		routeAvailability: routeAvailability,
		hostAvailability:  hostAvailability,
		heartbeatRequests: make(chan struct{}, 1),
	}
	result.accepting.Store(true)
	return result, nil
}

func (coordinator *Coordinator) PlacementConstrained() bool {
	return coordinator.placementConstrained.Load()
}

func (coordinator *Coordinator) BeginDrain(ctx context.Context) {
	coordinator.accepting.Store(false)
	if err := coordinator.heartbeat(ctx); err != nil {
		coordinator.logger.WarnContext(ctx, finalHeartbeatFailureEvent, "error", err)
	}
}

func (coordinator *Coordinator) Run(ctx context.Context) error {
	runContext, cancel := context.WithCancel(ctx)
	defer cancel()

	done := make(chan struct{}, controlLoopCount)
	go func() {
		coordinator.runRouteRefresh(runContext)
		done <- struct{}{}
	}()
	go func() {
		coordinator.runHeartbeat(runContext)
		done <- struct{}{}
	}()
	<-done
	cancel()
	<-done
	return nil
}

func (coordinator *Coordinator) reportControlFailure(ctx context.Context, operation string, err error) {
	if err == nil || ctx.Err() != nil || errors.Is(err, context.Canceled) {
		return
	}
	if IsRetryable(err) {
		coordinator.logger.DebugContext(ctx, "edge control operation failed; retrying", "operation", operation, "error", err)
		return
	}
	coordinator.logger.ErrorContext(ctx, "edge control operation was rejected; retrying", "operation", operation, "error", err)
}
