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

//go:build linux || darwin

package processlock

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/sys/unix"
)

const (
	lockDirectoryMode = os.FileMode(0o700)
	lockFileMode      = os.FileMode(0o600)
	maximumOwnerBytes = 64
)

func acquire(directory, filename string) (*Lock, error) {
	if err := os.MkdirAll(directory, lockDirectoryMode); err != nil {
		return nil, fmt.Errorf("create process lock directory: %w", err)
	}
	path := filepath.Join(directory, filename)
	file, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, lockFileMode)
	if err != nil {
		return nil, fmt.Errorf("open process lock %q: %w", path, err)
	}
	if err := unix.Flock(int(file.Fd()), unix.LOCK_EX|unix.LOCK_NB); err != nil {
		if errors.Is(err, unix.EWOULDBLOCK) || errors.Is(err, unix.EAGAIN) {
			return nil, errors.Join(
				fmt.Errorf("%w: %s%s", ErrHeld, path, ownerDescription(file)),
				closeFile(file),
			)
		}
		return nil, errors.Join(
			fmt.Errorf("lock process file %q: %w", path, err),
			closeFile(file),
		)
	}
	if err := publishOwner(file, path); err != nil {
		return nil, errors.Join(err, release(file))
	}
	return &Lock{file: file}, nil
}

func publishOwner(file *os.File, path string) error {
	if err := file.Truncate(0); err != nil {
		return fmt.Errorf("truncate process lock %q: %w", path, err)
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return fmt.Errorf("seek process lock %q: %w", path, err)
	}
	if _, err := fmt.Fprintf(file, "%d\n", os.Getpid()); err != nil {
		return fmt.Errorf("write process lock %q: %w", path, err)
	}
	if err := file.Sync(); err != nil {
		return fmt.Errorf("sync process lock %q: %w", path, err)
	}
	return nil
}

func ownerDescription(file *os.File) string {
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return ""
	}
	contents, err := io.ReadAll(io.LimitReader(file, maximumOwnerBytes))
	if err != nil {
		return ""
	}
	owner := strings.TrimSpace(string(contents))
	if owner == "" {
		return ""
	}
	return fmt.Sprintf(" (owned by process %s)", owner)
}

func release(file *os.File) error {
	unlockErr := unix.Flock(int(file.Fd()), unix.LOCK_UN)
	if unlockErr != nil {
		unlockErr = fmt.Errorf("unlock process file: %w", unlockErr)
	}
	return errors.Join(unlockErr, closeFile(file))
}

func closeFile(file *os.File) error {
	if err := file.Close(); err != nil {
		return fmt.Errorf("close process lock: %w", err)
	}
	return nil
}
