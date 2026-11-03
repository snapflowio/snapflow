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

package atomicfile

import (
	"errors"
	"fmt"
	"os"

	"github.com/snapflowio/microvm-go/internal/resourcecleanup"
	"golang.org/x/sys/unix"
)

func groupByFilesystem(paths []string) ([][]string, error) {
	order := make([]uint64, 0, len(paths))
	groups := make(map[uint64][]string, len(paths))
	for _, path := range paths {
		var info unix.Stat_t
		if err := unix.Stat(path, &info); err != nil {
			return nil, fmt.Errorf("inspect %s for commit: %w", path, err)
		}
		if _, seen := groups[info.Dev]; !seen {
			order = append(order, info.Dev)
		}
		groups[info.Dev] = append(groups[info.Dev], path)
	}
	result := make([][]string, len(order))
	for index, device := range order {
		result[index] = groups[device]
	}
	return result, nil
}

func syncFilesystem(directory string) (returnErr error) {
	handle, err := os.Open(directory)
	if err != nil {
		return fmt.Errorf("open %s for sync: %w", directory, err)
	}
	defer func() {
		returnErr = errors.Join(returnErr, resourcecleanup.Close(handle, directory))
	}()
	if err := unix.Syncfs(int(handle.Fd())); err != nil {
		return fmt.Errorf("sync filesystem of %s: %w", directory, err)
	}
	return nil
}
