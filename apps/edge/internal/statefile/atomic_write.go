// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package statefile

import (
	"encoding/json"
	"fmt"
	"path/filepath"

	"github.com/snapflowio/common-go/pkg/atomicfile"
)

func WriteJSON(path string, value any) error {
	payload, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("encode state file: %w", err)
	}
	return WriteFile(path, payload)
}

func WriteFile(path string, payload []byte) error {
	if err := EnsureDirectory(filepath.Dir(path)); err != nil {
		return err
	}
	return atomicfile.WriteFile(path, payload, privateFileMode)
}
