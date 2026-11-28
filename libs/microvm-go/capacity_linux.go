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

package microvm

import (
	"fmt"
	"os"
	"runtime"
	"strings"

	"golang.org/x/sys/unix"

	"github.com/snapflowio/microvm-go/internal/filemode"
	"github.com/snapflowio/microvm-go/internal/hostmemory"
)

const (
	bytesPerGiB             = 1 << 30
	minimumDiskReserveBytes = 10 * bytesPerGiB
	diskReservePercent      = 10
	percent                 = 100
)

func defaultCapacity(dataDir string) (Capacity, error) {
	if strings.TrimSpace(dataDir) == "" {
		return Capacity{}, fmt.Errorf("data directory is required")
	}
	if err := os.MkdirAll(dataDir, filemode.SharedDirectory); err != nil {
		return Capacity{}, err
	}
	memoryBytes, err := hostmemory.Total()
	if err != nil {
		return Capacity{}, err
	}
	var disk unix.Statfs_t
	if err := unix.Statfs(dataDir, &disk); err != nil {
		return Capacity{}, err
	}
	diskBytes := admittableDiskBytes(uint64(disk.Bavail)*uint64(disk.Bsize), uint64(disk.Blocks)*uint64(disk.Bsize))
	return Capacity{CPUVCPUs: int64(runtime.NumCPU()), MemoryMiB: admittableMemoryMiB(memoryBytes), DiskGiB: maxOneGiB(diskBytes)}, nil
}

func admittableDiskBytes(availableBytes, filesystemBytes uint64) uint64 {
	reserve := max(minimumDiskReserveBytes, filesystemBytes*diskReservePercent/percent)
	if availableBytes <= reserve {
		return 0
	}
	return availableBytes - reserve
}

func maxOneGiB(bytes uint64) int64 {
	value := int64(bytes / bytesPerGiB)
	if value < 1 {
		return 1
	}
	return value
}
