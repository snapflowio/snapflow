// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package daemon

import (
	"context"
	"time"

	"github.com/snapflowio/snapflow/internal/foundation/systemd"
	sandboxruntime "github.com/snapflowio/snapflow/internal/workloads/runtime"
)

const (
	watchdogPingsPerInterval = 2
	watchdogProbeFraction    = 4
)

type healthProbe interface {
	Health(ctx context.Context) []sandboxruntime.ServiceHealth
}

type watchdog struct {
	ticker  *time.Ticker
	timeout time.Duration
}

func (daemon *Daemon) startWatchdog() *watchdog {
	notifier := daemon.options.platform.notifier
	if err := notifier.Notify(systemd.Ready); err != nil {
		daemon.logger.Warn("Failed to report readiness to systemd", "error", err)
	}
	interval, err := notifier.WatchdogInterval()
	if err != nil {
		daemon.logger.Warn("Failed to read the systemd watchdog interval", "error", err)
		return &watchdog{}
	}
	if interval <= 0 {
		return &watchdog{}
	}
	return &watchdog{
		ticker:  time.NewTicker(interval / watchdogPingsPerInterval),
		timeout: interval / watchdogProbeFraction,
	}
}

func (dog *watchdog) ticks() <-chan time.Time {
	if dog.ticker == nil {
		return nil
	}
	return dog.ticker.C
}

func (dog *watchdog) stop() {
	if dog.ticker != nil {
		dog.ticker.Stop()
	}
}

func (daemon *Daemon) ping(ctx context.Context, dog *watchdog, probe healthProbe) {
	probeContext, cancel := context.WithTimeout(ctx, dog.timeout)
	defer cancel()
	for _, service := range probe.Health(probeContext) {
		if !service.Healthy {
			daemon.logger.Warn("Withholding the systemd watchdog ping; the runtime is unhealthy",
				"service", service.Name, "error", service.Error)
			return
		}
	}
	if err := daemon.options.platform.notifier.Notify(systemd.Watchdog); err != nil {
		daemon.logger.Warn("Failed to ping the systemd watchdog", "error", err)
	}
}

func (daemon *Daemon) notifyStopping() {
	if err := daemon.options.platform.notifier.Notify(systemd.Stopping); err != nil {
		daemon.logger.Warn("Failed to report shutdown to systemd", "error", err)
	}
}

func (daemon *Daemon) notify(state string) {
	if err := daemon.options.platform.notifier.Notify(state); err != nil {
		daemon.logger.Warn("Failed to notify systemd", "error", err)
	}
}
