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

package microvm

import (
	"fmt"
	"os"
	"runtime"
	"strings"

	"golang.org/x/sys/unix"
)

func defaultCapacity(dataDir string) (Capacity, error) {
	if strings.TrimSpace(dataDir) == "" {
		return Capacity{}, fmt.Errorf("data directory is required")
	}
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return Capacity{}, err
	}
	memoryBytes, err := unix.SysctlUint64("hw.memsize")
	if err != nil {
		return Capacity{}, err
	}
	var disk unix.Statfs_t
	if err := unix.Statfs(dataDir, &disk); err != nil {
		return Capacity{}, err
	}
	diskBytes := uint64(disk.Bavail) * uint64(disk.Bsize)
	return Capacity{CPUVCPUs: int64(runtime.NumCPU()), MemoryGiB: maxOneGiB(memoryBytes), DiskGiB: maxOneGiB(diskBytes)}, nil
}

func maxOneGiB(bytes uint64) int64 {
	value := int64(bytes / (1 << 30))
	if value < 1 {
		return 1
	}
	return value
}
