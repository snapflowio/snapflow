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
	"strings"
	"syscall"

	"github.com/snapflowio/microvm-go/internal/filemode"
)

var (
	ErrHardlinkUnsupported = errors.New("hardlink unsupported")
	ErrReflinkUnsupported  = errors.New("reflink unsupported")
	ErrSparseUnsupported   = errors.New("sparse copy unsupported")
)

type CopyOptions struct {
	HardlinkRelativePaths map[string]struct{}
	SkipRelativePaths     map[string]struct{}
}

func CopyDir(srcDir, dstDir string) error {
	return CopyDirWithOptions(srcDir, dstDir, CopyOptions{})
}

func CopyDirWithOptions(srcDir, dstDir string, options CopyOptions) error {
	info, err := os.Stat(srcDir)
	if err != nil {
		return fmt.Errorf("stat source directory: %w", err)
	}
	if !info.IsDir() {
		return fmt.Errorf("source path is not a directory: %s", srcDir)
	}
	if err := os.MkdirAll(dstDir, info.Mode().Perm()); err != nil {
		return fmt.Errorf("create destination directory: %w", err)
	}
	copier := &dirCopier{srcDir: srcDir, dstDir: dstDir, options: options}
	return filepath.WalkDir(srcDir, copier.visit)
}

type dirCopier struct {
	srcDir      string
	dstDir      string
	options     CopyOptions
	reflinkDead bool
}

func (c *dirCopier) visit(path string, entry fs.DirEntry, walkErr error) error {
	if walkErr != nil {
		return walkErr
	}
	rel, err := filepath.Rel(c.srcDir, path)
	if err != nil {
		return fmt.Errorf("compute relative path: %w", err)
	}
	if rel == "." {
		return nil
	}
	rel = filepath.Clean(rel)
	if c.skipped(rel, entry) {
		if entry.IsDir() {
			return filepath.SkipDir
		}
		return nil
	}
	info, err := entry.Info()
	if err != nil {
		return fmt.Errorf("stat source entry %s: %w", path, err)
	}
	return c.copyEntry(path, rel, info.Mode())
}

func (c *dirCopier) skipped(rel string, entry fs.DirEntry) bool {
	_, skip := c.options.SkipRelativePaths[rel]
	return skip || shouldSkipRuntimePath(rel, entry)
}

func (c *dirCopier) copyEntry(path, rel string, mode fs.FileMode) error {
	dstPath := filepath.Join(c.dstDir, rel)
	switch {
	case mode.IsDir():
		if err := os.MkdirAll(dstPath, mode.Perm()); err != nil {
			return fmt.Errorf("create destination directory %s: %w", dstPath, err)
		}
		return nil
	case mode.IsRegular():
		return c.copyFile(path, rel, dstPath, mode)
	case mode&os.ModeSymlink != 0:
		return copySymlink(path, dstPath)
	case mode&os.ModeSocket != 0:
		return nil
	default:
		return fmt.Errorf("unsupported file type %s (%s)", path, mode.String())
	}
}

func (c *dirCopier) copyFile(path, rel, dstPath string, mode fs.FileMode) error {
	if _, hardlink := c.options.HardlinkRelativePaths[rel]; hardlink {
		if err := linkRegularFile(path, dstPath); err != nil {
			return fmt.Errorf("hardlink file %s: %w", path, err)
		}
		return nil
	}
	if err := copyRegularFile(path, dstPath, mode.Perm(), &c.reflinkDead); err != nil {
		return fmt.Errorf("copy file %s: %w", path, err)
	}
	return nil
}

func copySymlink(path, dstPath string) error {
	target, err := os.Readlink(path)
	if err != nil {
		return fmt.Errorf("read symlink %s: %w", path, err)
	}
	if err := os.Remove(dstPath); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("remove existing symlink destination %s: %w", dstPath, err)
	}
	if err := os.Symlink(target, dstPath); err != nil {
		return fmt.Errorf("create symlink %s: %w", dstPath, err)
	}
	return nil
}

func linkRegularFile(srcPath, dstPath string) error {
	if err := os.MkdirAll(filepath.Dir(dstPath), filemode.SharedDirectory); err != nil {
		return fmt.Errorf("create destination parent: %w", err)
	}
	if err := os.Remove(dstPath); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("remove existing destination: %w", err)
	}
	if err := os.Link(srcPath, dstPath); err != nil {
		if errors.Is(err, fs.ErrPermission) || errors.Is(err, syscall.EXDEV) || errors.Is(err, syscall.EMLINK) || errors.Is(err, syscall.ENOTSUP) {
			return fmt.Errorf("%w: %w", ErrHardlinkUnsupported, err)
		}
		return fmt.Errorf("link %s to %s: %w", srcPath, dstPath, err)
	}
	return nil
}

func CopyFile(srcPath, dstPath string) error {
	info, err := os.Stat(srcPath)
	if err != nil {
		return fmt.Errorf("stat source file: %w", err)
	}
	if !info.Mode().IsRegular() {
		return fmt.Errorf("source path is not a regular file: %s", srcPath)
	}
	reflinkDead := false
	return copyRegularFile(srcPath, dstPath, info.Mode().Perm(), &reflinkDead)
}

func copyRegularFile(srcPath, dstPath string, perms fs.FileMode, reflinkDead *bool) error {
	if err := os.MkdirAll(filepath.Dir(dstPath), filemode.SharedDirectory); err != nil {
		return fmt.Errorf("create destination parent: %w", err)
	}
	if reflinkDead == nil || !*reflinkDead {
		err := copyRegularFileReflink(srcPath, dstPath, perms)
		if err == nil {
			return nil
		}
		if !errors.Is(err, ErrReflinkUnsupported) {
			return err
		}
		if reflinkDead != nil {
			*reflinkDead = true
		}
	}
	if err := copyRegularFileSparse(srcPath, dstPath, perms); err == nil {
		return nil
	} else if !errors.Is(err, ErrSparseUnsupported) {
		return err
	}
	return copyRegularFilePlain(srcPath, dstPath, perms)
}

func shouldSkipRuntimePath(rel string, entry fs.DirEntry) bool {
	base := filepath.Base(rel)
	if entry.IsDir() {
		return rel == "logs"
	}
	return strings.HasSuffix(base, ".sock") ||
		strings.HasSuffix(base, ".tmp") ||
		base == "vmm.pid"
}
