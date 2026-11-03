// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package notices

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func noticePrefixes() []string {
	return []string{"notice"}
}

func licensePrefixes() []string {
	return []string{"license", "licence", "copying"}
}

const (
	apacheLicenseName    = "Apache License"
	apacheLicenseVersion = "Version 2.0"
)

func findFile(directory string, prefixes []string) (string, error) {
	entries, err := os.ReadDir(directory)
	if err != nil {
		return "", fmt.Errorf("read module directory %s: %w", directory, err)
	}
	for _, entry := range entries {
		if entry.Type().IsRegular() && hasAnyPrefix(strings.ToLower(entry.Name()), prefixes) {
			return filepath.Join(directory, entry.Name()), nil
		}
	}
	return "", nil
}

func hasAnyPrefix(value string, prefixes []string) bool {
	for _, prefix := range prefixes {
		if strings.HasPrefix(value, prefix) {
			return true
		}
	}
	return false
}

func isApacheLicense(license string) bool {
	return strings.Contains(license, apacheLicenseName) && strings.Contains(license, apacheLicenseVersion)
}
