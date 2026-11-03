// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package install

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

func syncTree(root string) error {
	var syncErr error
	err := filepath.Walk(root, func(path string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		file, err := os.Open(path)
		if err != nil {
			return err
		}
		syncErr = errors.Join(file.Sync(), file.Close())
		return syncErr
	})
	if err != nil {
		return fmt.Errorf("sync Snapflow release: %w", err)
	}
	return nil
}
