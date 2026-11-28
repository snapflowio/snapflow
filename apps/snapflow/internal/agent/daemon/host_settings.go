// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package daemon

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/snapflowio/snapflow/internal/foundation/config"
	"github.com/snapflowio/snapflow/internal/foundation/state"
	"github.com/snapflowio/snapflow/internal/install"
	"github.com/snapflowio/snapflow/internal/network/control"
	"github.com/snapflowio/tunnel-go/reconnect"
)

const (
	hostSettingsReadMargin          = 10 * time.Second
	hostSettingsReadTimeout         = control.LongPollWait + hostSettingsReadMargin
	minimumHostSettingsReadInterval = time.Second
)

type hostOffer struct {
	OfferedVCPUs      int64
	OfferedMemoryGiB  int64
	OfferedDiskGiB    int64
	MaxUnclaimedFloat int64
}

func localHostOffer(cfg *config.Config) hostOffer {
	return hostOffer{
		OfferedVCPUs:      cfg.Runtime.OfferedVCPUs,
		OfferedMemoryGiB:  cfg.Runtime.OfferedMemoryGiB,
		OfferedDiskGiB:    cfg.Runtime.OfferedDiskGiB,
		MaxUnclaimedFloat: cfg.Settlement.MaxUnclaimedFloat,
	}
}

func effectiveHostOffer(local hostOffer, dashboard state.HostSettings) hostOffer {
	pick := func(set *int64, fallback int64) int64 {
		if set != nil {
			return *set
		}
		return fallback
	}
	return hostOffer{
		OfferedVCPUs:      pick(dashboard.OfferedVCPUs, local.OfferedVCPUs),
		OfferedMemoryGiB:  pick(dashboard.OfferedMemoryGiB, local.OfferedMemoryGiB),
		OfferedDiskGiB:    pick(dashboard.OfferedDiskGiB, local.OfferedDiskGiB),
		MaxUnclaimedFloat: pick(dashboard.MaxUnclaimedFloat, local.MaxUnclaimedFloat),
	}
}

func (daemon *Daemon) applyHostSettings() error {
	dashboard, err := state.LoadHostSettings(daemon.cfg.Machine.StateDirectory)
	if err != nil {
		return err
	}
	daemon.localSettings = localHostOffer(daemon.cfg)
	daemon.appliedSettings = effectiveHostOffer(daemon.localSettings, dashboard)
	daemon.cfg.Runtime.OfferedVCPUs = daemon.appliedSettings.OfferedVCPUs
	daemon.cfg.Runtime.OfferedMemoryGiB = daemon.appliedSettings.OfferedMemoryGiB
	daemon.cfg.Runtime.OfferedDiskGiB = daemon.appliedSettings.OfferedDiskGiB
	daemon.cfg.Settlement.MaxUnclaimedFloat = daemon.appliedSettings.MaxUnclaimedFloat
	daemon.setHostNetwork(dashboard)
	return nil
}

type hostSettingsWatcher struct {
	daemon *Daemon
	digest string
}

func (watcher *hostSettingsWatcher) Run(ctx context.Context) error {
	failures := reconnect.DefaultBackoff()
	for {
		startedAt := time.Now()
		restart, err := watcher.refresh(ctx)
		if restart != nil || ctx.Err() != nil {
			return restart
		}
		if errors.Is(err, control.ErrMachineRemoved) {
			return err
		}
		delay := minimumHostSettingsReadInterval - time.Since(startedAt)
		if err == nil {
			failures.Reset()
		} else {
			watcher.daemon.logger.WarnContext(ctx, "Failed to apply the machine's host settings", "error", err)
			delay = failures.Next()
		}
		if !reconnect.Wait(ctx, delay) {
			return nil
		}
	}
}

func (watcher *hostSettingsWatcher) refresh(ctx context.Context) (restart, err error) {
	readContext, cancel := context.WithTimeout(ctx, hostSettingsReadTimeout)
	defer cancel()
	daemon := watcher.daemon
	document, changed, err := daemon.client.FetchHostSettings(readContext, watcher.digest)
	if err != nil || !changed {
		return nil, err
	}
	settings, err := control.HostSettingsFromDocument(document)
	if err != nil {
		watcher.digest = document.Digest
		daemon.logger.ErrorContext(ctx, "Rejected the machine's host settings; keeping the last applied ones",
			"error", err, "applied", daemon.appliedSettings)
		return nil, nil
	}
	if err := install.SaveMaintenanceWindow(daemon.cfg.Profile, settings.MaintenanceWindow); err != nil {
		return nil, err
	}
	if err := state.SaveHostSettings(daemon.cfg.Machine.StateDirectory, settings.Daemon); err != nil {
		return nil, err
	}
	daemon.setHostNetwork(settings.Daemon)
	if err := daemon.applyHostNetwork(ctx); err != nil {
		return nil, err
	}
	watcher.digest = document.Digest
	daemon.reportUpdateStatus(ctx)
	wanted := effectiveHostOffer(daemon.localSettings, settings.Daemon)
	if wanted == daemon.appliedSettings {
		return nil, nil
	}
	daemon.logger.InfoContext(ctx, "The host settings changed this machine's offer or float; restarting to apply them",
		"applied", daemon.appliedSettings, "wanted", wanted)
	return fmt.Errorf("%w: the host settings changed", control.ErrRestartRequired), nil
}
