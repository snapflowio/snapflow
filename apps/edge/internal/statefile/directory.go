// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package statefile

import (
	"fmt"
	"os"
)

const (
	privateDirectoryMode      = os.FileMode(0o700)
	privateFileMode           = os.FileMode(0o600)
	nonOwnerPermissionBitmask = os.FileMode(0o077)
)

func EnsureDirectory(path string) error {
	if err := os.MkdirAll(path, privateDirectoryMode); err != nil {
		return fmt.Errorf("create state directory %s: %w", path, err)
	}
	return nil
}
