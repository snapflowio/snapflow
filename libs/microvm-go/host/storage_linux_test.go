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
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/sys/unix"
)

func TestDataDirStorageWarnsOnLoopDevices(t *testing.T) {
	dataDir := t.TempDir()
	sysfs := t.TempDir()
	if err := checkDataDirStorageAt(sysfs, dataDir); err != nil {
		t.Fatalf("plain block device produced a warning: %v", err)
	}
	var info unix.Stat_t
	if err := unix.Stat(dataDir, &info); err != nil {
		t.Fatal(err)
	}
	loopDir := filepath.Join(sysfs, fmt.Sprintf("%d:%d", unix.Major(info.Dev), unix.Minor(info.Dev)), "loop")
	if err := os.MkdirAll(loopDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(loopDir, "backing_file"), []byte("/var/lib/snapflow.img"), 0o644); err != nil {
		t.Fatal(err)
	}
	err := checkDataDirStorageAt(sysfs, dataDir)
	if err == nil || !strings.Contains(err.Error(), "/var/lib/snapflow.img") {
		t.Fatalf("loop-backed data dir warning = %v", err)
	}
}
