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

package logtrim

import (
	"errors"
	"fmt"
	"os"

	"golang.org/x/sys/unix"
)

const statBlockBytes = 512

func Trim(path string, maxBytes, keepBytes int64) error {
	file, err := os.OpenFile(path, os.O_WRONLY, 0)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("open log %s: %w", path, err)
	}
	defer file.Close()
	var stat unix.Stat_t
	if err := unix.Fstat(int(file.Fd()), &stat); err != nil {
		return fmt.Errorf("stat log %s: %w", path, err)
	}
	if stat.Blocks*statBlockBytes <= maxBytes || stat.Size <= keepBytes {
		return nil
	}
	length := (stat.Size - keepBytes) / stat.Blksize * stat.Blksize
	if length <= 0 {
		return nil
	}
	if err := unix.Fallocate(int(file.Fd()), unix.FALLOC_FL_PUNCH_HOLE|unix.FALLOC_FL_KEEP_SIZE, 0, length); err != nil {
		return fmt.Errorf("release the old part of log %s: %w", path, err)
	}
	return nil
}
