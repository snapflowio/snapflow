// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tunnel

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/snapflowio/tunnel-go/reconnect"
)

type servingSession interface {
	renewalDue() time.Time
	failed() <-chan struct{}
	failure() error
	drain(ctx context.Context, timeout time.Duration)
	close()
}

type sessionSupervisor struct {
	establish    func(context.Context) (servingSession, error)
	ready        func()
	log          *slog.Logger
	backoff      reconnect.Backoff
	drainTimeout time.Duration
}

type supervision struct {
	current             servingSession
	unavailableSince    time.Time
	unavailableReported bool
	renewalRetryAt      time.Time
	draining            sync.WaitGroup
}

func (supervisor *sessionSupervisor) run(ctx context.Context) {
	state := &supervision{unavailableSince: time.Now()}
	defer state.draining.Wait()
	defer func() {
		if state.current != nil {
			state.current.close()
		}
	}()
	for {
		if state.current == nil {
			if !supervisor.connect(ctx, state) {
				return
			}
			if state.current == nil {
				continue
			}
		}
		if !supervisor.serve(ctx, state) {
			return
		}
	}
}

func (supervisor *sessionSupervisor) connect(ctx context.Context, state *supervision) bool {
	established, err := supervisor.establish(ctx)
	if ctx.Err() != nil {
		if err == nil {
			established.close()
		}
		return false
	}
	if err != nil {
		delay := supervisor.backoff.Next()
		state.unavailableReported = supervisor.reportUnavailable(
			state.unavailableSince,
			state.unavailableReported,
			delay,
			err,
		)
		return reconnect.Wait(ctx, delay)
	}
	state.current = established
	supervisor.backoff.Reset()
	state.renewalRetryAt = time.Time{}
	supervisor.ready()
	return true
}

func (supervisor *sessionSupervisor) serve(ctx context.Context, state *supervision) bool {
	renewAt := state.current.renewalDue()
	if state.renewalRetryAt.After(renewAt) {
		renewAt = state.renewalRetryAt
	}
	renewTimer := time.NewTimer(time.Until(renewAt))
	select {
	case <-ctx.Done():
		renewTimer.Stop()
		return false
	case <-state.current.failed():
		renewTimer.Stop()
		delay := supervisor.backoff.Next()
		supervisor.log.Warn("Machine tunnel disconnected", "retry_in", delay, "error", state.current.failure())
		state.current.close()
		state.current = nil
		state.unavailableSince = time.Now()
		state.unavailableReported = false
		return reconnect.Wait(ctx, delay)
	case <-renewTimer.C:
		return supervisor.renew(ctx, state)
	}
}

func (supervisor *sessionSupervisor) renew(ctx context.Context, state *supervision) bool {
	replacement, err := supervisor.establish(ctx)
	if ctx.Err() != nil {
		if err == nil {
			replacement.close()
		}
		return false
	}
	if err != nil {
		delay := supervisor.backoff.Next()
		state.renewalRetryAt = time.Now().Add(delay)
		supervisor.log.Warn(
			"Machine tunnel certificate renewal failed; the current session keeps serving",
			"retry_in", delay,
			"error", err,
		)
		return true
	}
	supervisor.backoff.Reset()
	state.renewalRetryAt = time.Time{}
	previous := state.current
	state.current = replacement
	drainTimeout := min(supervisor.drainTimeout, time.Until(replacement.renewalDue()))
	state.draining.Go(func() { previous.drain(ctx, drainTimeout) })
	return true
}

func (supervisor *sessionSupervisor) reportUnavailable(
	since time.Time,
	reported bool,
	delay time.Duration,
	err error,
) bool {
	if !reported && time.Since(since) >= initialConnectionGrace {
		supervisor.log.Warn("Machine tunnel unavailable", "retry_in", delay, "error", err)
		return true
	}
	supervisor.log.Debug("Machine tunnel connection pending", "retry_in", delay, "error", err)
	return reported
}
