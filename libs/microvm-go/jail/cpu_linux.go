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

package jail

import (
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
)

const (
	cpuStatFile    = "cpu.stat"
	cpuUsageField  = "usage_usec"
	cgroupRootPath = "/"
)

func CPUUsageMicros(pid int) (uint64, error) {
	cgroup, err := processCgroup(pid)
	if err != nil {
		return 0, err
	}
	for !strings.HasPrefix(path.Base(cgroup), scopePrefix) {
		if cgroup == cgroupRootPath || cgroup == "" {
			return 0, fmt.Errorf("process %d is not inside a microVM scope", pid)
		}
		cgroup = path.Dir(cgroup)
	}
	statistics := filepath.Join(cgroupMountRoot, cgroup, cpuStatFile)
	data, err := os.ReadFile(statistics)
	if err != nil {
		return 0, fmt.Errorf("read CPU statistics: %w", err)
	}
	for line := range strings.Lines(string(data)) {
		name, value, found := strings.Cut(strings.TrimSpace(line), " ")
		if !found || name != cpuUsageField {
			continue
		}
		usage, err := strconv.ParseUint(value, eventCountBase, eventCountBits)
		if err != nil {
			return 0, fmt.Errorf("parse %s in %s: %w", cpuUsageField, statistics, err)
		}
		return usage, nil
	}
	return 0, fmt.Errorf("%s has no %s", statistics, cpuUsageField)
}
