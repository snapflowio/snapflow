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

package jailidentity

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"syscall"
)

const (
	rootOwner                       = 0
	writePermissionBits fs.FileMode = 0o222
)

func GrantTree(root string, uid, gid uint32) error {
	return filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		sealed, err := hostSealed(entry)
		if err != nil {
			return fmt.Errorf("inspect %s: %w", path, err)
		}
		if sealed {
			return nil
		}
		if err := os.Lchown(path, int(uid), int(gid)); err != nil {
			return fmt.Errorf("give the VMM %s: %w", path, err)
		}
		return nil
	})
}

func GrantInstanceTree(instanceID, root string) error {
	uid, gid, err := ForInstance(instanceID)
	if err != nil {
		return fmt.Errorf("resolve VMM identity: %w", err)
	}
	return GrantTree(root, uid, gid)
}

func hostSealed(entry fs.DirEntry) (bool, error) {
	if !entry.Type().IsRegular() {
		return false, nil
	}
	info, err := entry.Info()
	if err != nil {
		return false, err
	}
	stat, ok := info.Sys().(*syscall.Stat_t)
	if !ok {
		return false, errors.New("file ownership is unavailable")
	}
	return stat.Uid == rootOwner && info.Mode().Perm()&writePermissionBits == 0, nil
}
