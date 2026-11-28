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

//go:build darwin

package forkvm

import (
	"errors"
	"fmt"
	"io/fs"
	"os"

	"github.com/snapflowio/microvm-go/internal/resourcecleanup"
	"golang.org/x/sys/unix"
)

var cloneFile = unix.Clonefile

func copyRegularFileReflink(srcPath, dstPath string, perms fs.FileMode) error {
	if err := os.Remove(dstPath); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("remove stale clone destination %s: %w", dstPath, err)
	}

	flags := unix.CLONE_NOFOLLOW | unix.CLONE_NOOWNERCOPY
	if err := cloneFile(srcPath, dstPath, flags); err != nil {
		if cloneUnsupported(err) {
			return fmt.Errorf("%w: clonefile %s: %v", ErrReflinkUnsupported, srcPath, err)
		}
		return fmt.Errorf("clonefile %s to %s: %w", srcPath, dstPath, err)
	}
	if err := os.Chmod(dstPath, perms); err != nil {
		return errors.Join(
			fmt.Errorf("chmod cloned file %s: %w", dstPath, err),
			resourcecleanup.Remove(dstPath, "invalid cloned file"),
		)
	}
	return nil
}

func cloneUnsupported(err error) bool {
	return errors.Is(err, unix.ENOTSUP) ||
		errors.Is(err, unix.EOPNOTSUPP) ||
		errors.Is(err, unix.EXDEV)
}
