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

package cputopology

import (
	"fmt"
	"strconv"
	"strings"
)

const (
	cpuListSeparator  = ","
	cpuRangeSeparator = "-"
)

// ThreadsPerCore is the largest SMT sibling group among cores, the unit in
// which tenants are given CPUs so no two of them share a physical core.
func ThreadsPerCore(cores [][]int) int {
	threads := 1
	for _, core := range cores {
		threads = max(threads, len(core))
	}
	return threads
}

// ParseList parses the kernel's CPU list format, such as "0-3,8,10-11".
func ParseList(value string) ([]int, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}
	var cpus []int
	for _, part := range strings.Split(value, cpuListSeparator) {
		first, last, isRange := strings.Cut(part, cpuRangeSeparator)
		start, err := strconv.Atoi(first)
		if err != nil {
			return nil, fmt.Errorf("parse CPU list %q: %w", value, err)
		}
		end := start
		if isRange {
			if end, err = strconv.Atoi(last); err != nil {
				return nil, fmt.Errorf("parse CPU list %q: %w", value, err)
			}
		}
		if start < 0 || end < start {
			return nil, fmt.Errorf("parse CPU list %q: invalid range %q", value, part)
		}
		for cpu := start; cpu <= end; cpu++ {
			cpus = append(cpus, cpu)
		}
	}
	return cpus, nil
}
