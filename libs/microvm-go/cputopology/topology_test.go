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
	"slices"
	"testing"
)

func TestParseListExpandsRangesAndSingles(t *testing.T) {
	cpus, err := ParseList("0-3,8,10-11\n")
	if err != nil {
		t.Fatal(err)
	}
	if want := []int{0, 1, 2, 3, 8, 10, 11}; !slices.Equal(cpus, want) {
		t.Fatalf("ParseList() = %v, want %v", cpus, want)
	}
	for _, invalid := range []string{"a", "3-1", "1-x"} {
		if _, err := ParseList(invalid); err == nil {
			t.Fatalf("ParseList(%q) accepted an invalid list", invalid)
		}
	}
}

func TestThreadsPerCoreIsTheLargestSiblingGroup(t *testing.T) {
	if threads := ThreadsPerCore([][]int{{0, 12}, {1, 13}, {2}}); threads != 2 {
		t.Fatalf("ThreadsPerCore() = %d, want 2", threads)
	}
	if threads := ThreadsPerCore(nil); threads != 1 {
		t.Fatalf("ThreadsPerCore(nil) = %d, want 1", threads)
	}
}
