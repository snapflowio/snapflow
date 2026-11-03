// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package availability

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"
)

type Monitor struct {
	mu          sync.Mutex
	service     string
	outageGrace time.Duration
	operations  map[string]*operationState
}

type operationState struct {
	outage   bool
	outageAt time.Time
	failures uint64
}

func NewMonitor(service string, outageGrace time.Duration) (*Monitor, error) {
	service = strings.TrimSpace(service)
	if service == "" {
		return nil, fmt.Errorf("availability monitor service is required")
	}
	if outageGrace < 0 {
		return nil, fmt.Errorf("availability monitor outage grace cannot be negative")
	}
	return &Monitor{
		service:     service,
		outageGrace: outageGrace,
		operations:  make(map[string]*operationState),
	}, nil
}

func (monitor *Monitor) Success(operation string) {
	operation = normalizeOperation(operation)
	now := time.Now()
	monitor.mu.Lock()
	state := monitor.operations[operation]
	if state == nil {
		monitor.mu.Unlock()
		return
	}
	delete(monitor.operations, operation)
	monitor.mu.Unlock()

	if state.outage {
		slog.Info(
			monitor.service+" recovered",
			"operation", operation,
			"unavailable_for", now.Sub(state.outageAt),
			"failed_requests", state.failures,
		)
	}
}

func (monitor *Monitor) Failure(operation string, err error) {
	if err == nil {
		monitor.Success(operation)
		return
	}
	if errors.Is(err, context.Canceled) {
		return
	}
	operation = normalizeOperation(operation)
	now := time.Now()
	monitor.mu.Lock()
	state := monitor.operations[operation]
	if state == nil {
		state = &operationState{outageAt: now}
		monitor.operations[operation] = state
	}
	state.failures++
	shouldDebug := state.failures == 1
	shouldReport := !state.outage &&
		now.Sub(state.outageAt) >= monitor.outageGrace
	if shouldReport {
		state.outage = true
	}
	failures := state.failures
	alreadyReported := state.outage && !shouldReport
	monitor.mu.Unlock()

	if shouldReport {
		slog.Warn(
			monitor.service+" unavailable",
			"operation", operation,
			"failed_requests", failures,
			"error", err,
		)
		return
	}
	if alreadyReported || !shouldDebug {
		return
	}
	slog.Debug(
		monitor.service+" request deferred",
		"operation", operation,
		"failed_requests", failures,
		"error", err,
	)
}

func normalizeOperation(operation string) string {
	operation = strings.TrimSpace(operation)
	if operation == "" {
		return "request"
	}
	return operation
}
