// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package abuse

import (
	"context"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/snapflowio/common-go/pkg/apierror"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	"github.com/snapflowio/tunnel-go/reconnect"
)

const (
	maximumQueuedFlows   = 200_000
	maximumQueuedReports = 2048
	maximumRetryDelay    = 10 * time.Minute
	retryBackoffFactor   = 2
	retryBackoffJitter   = 0.2
)

type queuedReport struct {
	report   apiclient.MachineConnectionReport
	sequence uint64
	window   uint64
	flows    int
}

type connectionQueue struct {
	mu       sync.Mutex
	reports  []queuedReport
	flows    int
	sequence uint64
	windows  uint64
	ready    chan struct{}
	backoff  reconnect.Backoff
	logger   *slog.Logger
}

func newConnectionQueue(logger *slog.Logger) (*connectionQueue, error) {
	backoff := reconnect.Backoff{
		Minimum: Window,
		Maximum: maximumRetryDelay,
		Factor:  retryBackoffFactor,
		Jitter:  retryBackoffJitter,
	}
	if err := backoff.Validate(); err != nil {
		return nil, err
	}
	return &connectionQueue{ready: make(chan struct{}, 1), backoff: backoff, logger: logger}, nil
}

func (queue *connectionQueue) enqueue(ctx context.Context, reports []apiclient.MachineConnectionReport) {
	queue.mu.Lock()
	queue.windows++
	for _, report := range reports {
		queue.sequence++
		flows := reportFlows(report)
		queue.reports = append(queue.reports, queuedReport{
			report: report, sequence: queue.sequence, window: queue.windows, flows: flows,
		})
		queue.flows += flows
	}
	for len(queue.reports) > 0 && (queue.flows > maximumQueuedFlows || len(queue.reports) > maximumQueuedReports) {
		dropped := queue.reports[0]
		queue.reports = queue.reports[1:]
		queue.flows -= dropped.flows
		queue.markIncomplete(dropped.window)
		queue.logger.WarnContext(ctx, "Dropped unsent connection records to bound the report queue",
			"flows", dropped.flows, "windowStart", dropped.report.WindowStart)
	}
	queue.mu.Unlock()
	select {
	case queue.ready <- struct{}{}:
	default:
	}
}

func (queue *connectionQueue) markIncomplete(window uint64) {
	last := -1
	for index := range queue.reports {
		if queue.reports[index].window == window {
			last = index
		}
	}
	if last >= 0 {
		queue.reports[last].report.Complete = false
	}
}

func (queue *connectionQueue) head() (queuedReport, bool) {
	queue.mu.Lock()
	defer queue.mu.Unlock()
	if len(queue.reports) == 0 {
		return queuedReport{}, false
	}
	return queue.reports[0], true
}

func (queue *connectionQueue) settle(sent queuedReport, rejected bool) {
	queue.mu.Lock()
	defer queue.mu.Unlock()
	if len(queue.reports) == 0 || queue.reports[0].sequence != sent.sequence {
		return
	}
	queue.reports = queue.reports[1:]
	queue.flows -= sent.flows
	if rejected {
		queue.markIncomplete(sent.window)
	}
}

func (queue *connectionQueue) run(ctx context.Context, control Control) {
	for {
		delay, err := queue.flush(ctx, control)
		if err != nil && ctx.Err() == nil {
			queue.logger.WarnContext(ctx, "Failed to send sandbox connection records; retrying", "retryIn", delay, "error", err)
		}
		wake := queue.ready
		var retry <-chan time.Time
		if delay > 0 {
			wake = nil
			retry = time.After(delay)
		}
		select {
		case <-ctx.Done():
			return
		case <-wake:
		case <-retry:
		}
	}
}

func (queue *connectionQueue) flush(ctx context.Context, control Control) (time.Duration, error) {
	for {
		next, ok := queue.head()
		if !ok {
			queue.backoff.Reset()
			return 0, nil
		}
		next.report.SentAt = time.Now().UTC()
		err := control.ReportConnections(ctx, next.report)
		if err != nil && retryable(err) {
			return queue.backoff.Next(), err
		}
		if err != nil {
			queue.logger.ErrorContext(ctx, "The control plane rejected a sandbox connection report", "error", err)
		}
		queue.settle(next, err != nil)
	}
}

func retryable(err error) bool {
	return !apierror.IsPermanent(err) ||
		apierror.HasStatus(err, http.StatusUnauthorized) ||
		apierror.HasStatus(err, http.StatusForbidden)
}

func reportFlows(report apiclient.MachineConnectionReport) int {
	flows := 0
	for _, sandbox := range report.Sandboxes {
		flows += len(sandbox.Flows)
	}
	for _, builder := range report.Builders {
		flows += len(builder.Flows)
	}
	return flows
}
