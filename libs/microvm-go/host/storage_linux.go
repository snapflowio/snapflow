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

package host

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/sys/unix"
)

const sysfsBlockDevices = "/sys/dev/block"

func checkDataDirStorage(dataDir string) error {
	return checkDataDirStorageAt(sysfsBlockDevices, dataDir)
}

func checkDataDirStorageAt(sysfsRoot, dataDir string) error {
	var info unix.Stat_t
	if err := unix.Stat(dataDir, &info); err != nil {
		return fmt.Errorf("inspect microvm data dir storage: %w", err)
	}
	device := fmt.Sprintf("%d:%d", unix.Major(info.Dev), unix.Minor(info.Dev))
	backing, err := os.ReadFile(filepath.Join(sysfsRoot, device, "loop", "backing_file"))
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("inspect microvm data dir block device %s: %w", device, err)
	}
	return fmt.Errorf(
		"microvm data dir %s is on loop device %s backed by %s; every fsync is flushed twice, so lifecycle operations are slower than on a partition or logical volume",
		dataDir,
		device,
		strings.TrimSpace(string(backing)),
	)
}
