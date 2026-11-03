// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

//go:build linux || darwin

package tuf

import (
	"fmt"

	"golang.org/x/sys/unix"
)

func requireAvailableStorage(path string, required uint64) error {
	var statistics unix.Statfs_t
	if err := unix.Statfs(path, &statistics); err != nil {
		return fmt.Errorf("inspect Snapflow release storage: %w", err)
	}
	available := uint64(statistics.Bavail) * uint64(statistics.Bsize)
	if available < required {
		return fmt.Errorf("the Snapflow release storage requires %d bytes but only %d bytes are available", required, available)
	}
	return nil
}
