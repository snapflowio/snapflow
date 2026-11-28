// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package daemon

import (
	"context"
	"fmt"

	"github.com/snapflowio/snapflow/internal/foundation/config"
	"github.com/snapflowio/snapflow/internal/foundation/system"
	"github.com/snapflowio/snapflow/internal/foundation/systemd"
)

func (daemon *Daemon) retire(ctx context.Context) {
	daemon.logger.WarnContext(ctx, "This machine was removed in the dashboard; disabling the Snapflow service")
	if err := daemon.options.platform.retire(ctx, daemon.cfg.Profile.Name); err != nil {
		daemon.logger.ErrorContext(ctx, "Failed to disable the Snapflow service; run `sudo snapflow uninstall`", "error", err)
	}
}

func disableServices(manager systemd.Manager) ServiceRetirer {
	return func(ctx context.Context, profile config.ProfileName) error {
		if profile == config.Development {
			return nil
		}
		units := []string{system.UpdateTimerUnit, system.ServiceUnit}
		if err := manager.Disable(ctx, units...); err != nil {
			return fmt.Errorf("disable the Snapflow services: %w", err)
		}
		if err := manager.QueueStop(ctx, append(units, system.VMSliceUnit)...); err != nil {
			return fmt.Errorf("stop the Snapflow services: %w", err)
		}
		return nil
	}
}
