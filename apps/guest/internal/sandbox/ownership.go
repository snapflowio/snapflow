// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package sandbox

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"syscall"
)

func (u User) Own(path string) error {
	if u.IsRoot() {
		return nil
	}
	if err := os.Lchown(path, int(u.UID), int(u.GID)); err != nil {
		return fmt.Errorf("give %s to %s: %w", path, u.Name, err)
	}
	return nil
}

func (u User) OwnTree(root string) error {
	if u.IsRoot() {
		return nil
	}
	return filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		info, err := entry.Info()
		if err != nil {
			return fmt.Errorf("inspect %s: %w", path, err)
		}
		stat, ok := info.Sys().(*syscall.Stat_t)
		if !ok || stat.Uid != 0 {
			return nil
		}
		return u.Own(path)
	})
}

func (u User) MkdirAll(path string, mode os.FileMode) error {
	missing, err := missingDirectories(path)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(path, mode); err != nil {
		return fmt.Errorf("create %s: %w", path, err)
	}
	for _, created := range missing {
		if err := u.Own(created); err != nil {
			return err
		}
	}
	return nil
}

func missingDirectories(path string) ([]string, error) {
	var missing []string
	for current := filepath.Clean(path); ; current = filepath.Dir(current) {
		_, err := os.Lstat(current)
		if err == nil {
			return missing, nil
		}
		if !errors.Is(err, fs.ErrNotExist) {
			return nil, fmt.Errorf("inspect %s: %w", current, err)
		}
		missing = append(missing, current)
		if parent := filepath.Dir(current); parent == current {
			return missing, nil
		}
	}
}

func (u User) OwnFile(file *os.File) error {
	if u.IsRoot() {
		return nil
	}
	if err := file.Chown(int(u.UID), int(u.GID)); err != nil {
		return fmt.Errorf("give %s to %s: %w", file.Name(), u.Name, err)
	}
	return nil
}
