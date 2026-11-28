// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package fs

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"syscall"

	"github.com/snapflowio/guest/internal/sandbox"
)

const (
	uploadDirectoryMode = 0o755
	uploadFileMode      = 0o644
	temporarySuffix     = ".upload-*"
)

type fileTarget struct {
	path  string
	mode  fs.FileMode
	owner func(path string) error
}

func writeFile(destination string, source io.Reader) (written int64, resultErr error) {
	user, err := sandbox.DefaultUser()
	if err != nil {
		return 0, err
	}
	target, err := resolveTarget(destination, user)
	if err != nil {
		return 0, err
	}
	if err := user.MkdirAll(filepath.Dir(target.path), uploadDirectoryMode); err != nil {
		return 0, fmt.Errorf("mkdir: %w", err)
	}
	temporary, err := os.CreateTemp(filepath.Dir(target.path), filepath.Base(target.path)+temporarySuffix)
	if err != nil {
		return 0, fmt.Errorf("create: %w", err)
	}
	defer func() {
		if resultErr != nil {
			resultErr = errors.Join(resultErr, os.Remove(temporary.Name()))
		}
	}()
	written, copyErr := io.Copy(temporary, source)
	if err := errors.Join(copyErr, temporary.Chmod(target.mode), temporary.Close()); err != nil {
		return written, fmt.Errorf("write: %w", err)
	}
	if err := target.owner(temporary.Name()); err != nil {
		return written, fmt.Errorf("own: %w", err)
	}
	if err := os.Rename(temporary.Name(), target.path); err != nil {
		return written, fmt.Errorf("install: %w", err)
	}
	return written, nil
}

func resolveTarget(destination string, user sandbox.User) (fileTarget, error) {
	path, err := filepath.EvalSymlinks(destination)
	if errors.Is(err, fs.ErrNotExist) {
		return fileTarget{path: destination, mode: uploadFileMode, owner: user.Own}, nil
	}
	if err != nil {
		return fileTarget{}, fmt.Errorf("resolve %s: %w", destination, err)
	}
	info, err := os.Stat(path)
	if err != nil {
		return fileTarget{}, fmt.Errorf("inspect %s: %w", path, err)
	}
	if !info.Mode().IsRegular() {
		return fileTarget{}, fmt.Errorf("%s is not a regular file", destination)
	}
	stat, ok := info.Sys().(*syscall.Stat_t)
	if !ok {
		return fileTarget{path: path, mode: info.Mode().Perm(), owner: user.Own}, nil
	}
	return fileTarget{
		path: path,
		mode: info.Mode().Perm(),
		owner: func(temporary string) error {
			return os.Lchown(temporary, int(stat.Uid), int(stat.Gid))
		},
	}, nil
}
