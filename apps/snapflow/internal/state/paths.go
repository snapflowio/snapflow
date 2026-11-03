// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package state

import (
	"errors"
	"path/filepath"
	"strings"
)

func resolveDirectory(configured string) (string, error) {
	configured = strings.TrimSpace(configured)
	if configured == "" {
		return "", errors.New("the Snapflow state directory is required")
	}
	if !filepath.IsAbs(configured) {
		return "", errors.New("the Snapflow state directory must be absolute")
	}
	return filepath.Clean(configured), nil
}
