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

package diskusage

import (
	"os"
	"syscall"
)

const statBlockBytes = 512

type fileIdentity struct {
	device uint64
	inode  uint64
}

func allocatedBytesOnce(path string, seen map[fileIdentity]struct{}) int64 {
	info, err := os.Lstat(path)
	if err != nil {
		return 0
	}
	stat, ok := info.Sys().(*syscall.Stat_t)
	if !ok {
		return fileSize(info)
	}
	if info.Mode().IsRegular() && stat.Nlink > 1 {
		identity := fileIdentity{device: uint64(stat.Dev), inode: stat.Ino}
		if _, exists := seen[identity]; exists {
			return 0
		}
		seen[identity] = struct{}{}
	}
	return stat.Blocks * statBlockBytes
}

func fileSize(info os.FileInfo) int64 {
	if info.Mode().IsRegular() {
		return info.Size()
	}
	return 0
}
