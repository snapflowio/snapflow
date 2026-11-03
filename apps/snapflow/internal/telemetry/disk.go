// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package telemetry

import (
	"context"
	"fmt"

	"github.com/shirou/gopsutil/v4/disk"
)

func DiskUsagePercent(ctx context.Context, path string) (float64, error) {
	usage, err := disk.UsageWithContext(ctx, path)
	if err != nil {
		return 0, fmt.Errorf("measure disk usage of %s: %w", path, err)
	}
	return usage.UsedPercent, nil
}
