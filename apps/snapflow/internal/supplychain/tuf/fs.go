// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tuf

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/snapflowio/common-go/pkg/atomicfile"
)

const (
	repositoryDirectoryMode os.FileMode = 0o755
	repositoryFileMode      os.FileMode = 0o644
)

func writeFile(path string, contents []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), repositoryDirectoryMode); err != nil {
		return fmt.Errorf("create parent directory for %q: %w", path, err)
	}
	return atomicfile.WriteFile(path, contents, repositoryFileMode)
}

func syncDirectories(paths ...string) error {
	for _, path := range paths {
		if err := atomicfile.SyncDirectory(path); err != nil {
			return err
		}
	}
	return nil
}
