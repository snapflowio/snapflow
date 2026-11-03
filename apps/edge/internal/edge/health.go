// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package edge

import (
	"context"

	"github.com/snapflowio/edge/internal/telemetry"
)

func CheckHealth(ctx context.Context) error {
	return telemetry.CheckReadiness(ctx, metricsListen)
}
