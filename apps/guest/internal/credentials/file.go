// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package credentials

import (
	"crypto/subtle"
	"errors"
	"fmt"
	"os"
	"strings"
)

var ErrEmpty = errors.New("credential file is empty")

func ReadFile(filePath string) ([]byte, error) {
	if strings.TrimSpace(filePath) == "" {
		return nil, errors.New("credential file path is required")
	}
	credential, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", filePath, err)
	}
	credential = []byte(strings.TrimSpace(string(credential)))
	if len(credential) == 0 {
		return nil, ErrEmpty
	}
	return credential, nil
}

func MatchesFile(filePath string, provided []byte) (bool, error) {
	expected, err := ReadFile(filePath)
	if err != nil {
		return false, err
	}
	return subtle.ConstantTimeCompare(provided, expected) == 1, nil
}
