// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package daemon

import (
	"context"

	"github.com/snapflowio/snapflow/internal/install"
)

func (daemon *Daemon) reportUpdateStatus(ctx context.Context) {
	status, err := install.InspectUpdateStatus(daemon.cfg.Profile)
	if err == nil {
		err = daemon.client.ReportUpdateStatus(ctx, status)
	}
	if err != nil {
		daemon.logger.WarnContext(ctx, "Failed to report the machine's update status", "error", err)
	}
}
