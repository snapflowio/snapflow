// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package forkvm

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"syscall"

	"github.com/snapflowio/microvm-go/internal/filemode"
)

const sharedSnapshotFileMode fs.FileMode = 0o444

func ShareSnapshotFile(path string) error {
	if err := os.Chown(path, 0, 0); err != nil {
		return fmt.Errorf("own shared snapshot file: %w", err)
	}
	if err := os.Chmod(path, sharedSnapshotFileMode); err != nil {
		return fmt.Errorf("make shared snapshot file read-only: %w", err)
	}
	return nil
}

func IsSharedSnapshotFile(path string) (bool, error) {
	info, err := os.Lstat(path)
	if err != nil {
		return false, fmt.Errorf("inspect snapshot file: %w", err)
	}
	if !info.Mode().IsRegular() {
		return false, fmt.Errorf("snapshot file %s is not a regular file", path)
	}
	stat, ok := info.Sys().(*syscall.Stat_t)
	if !ok {
		return false, errors.New("read snapshot file ownership")
	}
	return stat.Uid == 0 && stat.Gid == 0 && info.Mode().Perm() == sharedSnapshotFileMode, nil
}

func LinkSharedSnapshotFile(source, target string) error {
	if err := os.MkdirAll(filepath.Dir(target), filemode.SharedDirectory); err != nil {
		return fmt.Errorf("create shared snapshot destination: %w", err)
	}
	if err := os.Remove(target); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("replace shared snapshot destination: %w", err)
	}
	if err := os.Link(source, target); err != nil {
		return fmt.Errorf("link shared snapshot file: %w", err)
	}
	return nil
}
