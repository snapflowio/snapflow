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

//go:build linux

package forkvm

import (
	"errors"
	"fmt"
	"io/fs"
	"os"

	"golang.org/x/sys/unix"
)

func copyRegularFileReflink(srcPath, dstPath string, perms fs.FileMode) (retErr error) {
	src, err := os.Open(srcPath)
	if err != nil {
		return err
	}
	defer src.Close()

	dst, err := os.OpenFile(dstPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, perms)
	if err != nil {
		return err
	}
	defer func() {
		if cerr := dst.Close(); retErr == nil && cerr != nil {
			retErr = cerr
		}
		if retErr != nil {
			if removeErr := os.Remove(dstPath); removeErr != nil && !errors.Is(removeErr, os.ErrNotExist) {
				retErr = errors.Join(retErr, fmt.Errorf("remove incomplete destination: %w", removeErr))
			}
		}
	}()

	if err := unix.IoctlFileClone(int(dst.Fd()), int(src.Fd())); err != nil {
		if reflinkUnsupported(err) {
			return fmt.Errorf("%w: %w", ErrReflinkUnsupported, err)
		}
		return fmt.Errorf("reflink %s to %s: %w", srcPath, dstPath, err)
	}
	return nil
}

func reflinkUnsupported(err error) bool {
	return errors.Is(err, unix.EINVAL) ||
		errors.Is(err, unix.ENOTSUP) ||
		errors.Is(err, unix.EOPNOTSUPP) ||
		errors.Is(err, unix.EXDEV) ||
		errors.Is(err, unix.ENOTTY)
}
