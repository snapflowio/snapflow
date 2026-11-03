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

package cputopology

import (
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strconv"
)

const (
	sysfsCPUPath       = "/sys/devices/system/cpu"
	onlineCPUsFile     = "online"
	threadSiblingsFile = "topology/thread_siblings_list"
	cpuDirectoryPrefix = "cpu"
)

// Cores groups the online logical CPUs into physical cores by their SMT
// siblings, ordered by each core's first CPU.
func Cores() ([][]int, error) {
	online, err := os.ReadFile(filepath.Join(sysfsCPUPath, onlineCPUsFile))
	if err != nil {
		return nil, fmt.Errorf("read online CPUs: %w", err)
	}
	cpus, err := ParseList(string(online))
	if err != nil {
		return nil, err
	}
	seen := make(map[int]struct{}, len(cpus))
	var cores [][]int
	for _, cpu := range cpus {
		if _, grouped := seen[cpu]; grouped {
			continue
		}
		path := filepath.Join(sysfsCPUPath, cpuDirectoryPrefix+strconv.Itoa(cpu), threadSiblingsFile)
		siblingList, err := os.ReadFile(path)
		if err != nil {
			return nil, fmt.Errorf("read SMT siblings of CPU %d: %w", cpu, err)
		}
		siblings, err := ParseList(string(siblingList))
		if err != nil {
			return nil, err
		}
		core := make([]int, 0, len(siblings))
		for _, sibling := range siblings {
			if slices.Contains(cpus, sibling) {
				seen[sibling] = struct{}{}
				core = append(core, sibling)
			}
		}
		cores = append(cores, core)
	}
	if len(cores) == 0 {
		return nil, fmt.Errorf("no online CPUs in %s", sysfsCPUPath)
	}
	return cores, nil
}
