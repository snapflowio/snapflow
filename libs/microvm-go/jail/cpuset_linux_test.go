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
	"slices"
	"testing"
)

func TestCPUMaskRoundTripsThroughSystemdBitmask(t *testing.T) {
	cpus := []int{0, 7, 8, 13}
	mask := cpuMask(cpus)
	if want := []byte{0b1000_0001, 0b0010_0001}; !slices.Equal(mask, want) {
		t.Fatalf("cpuMask(%v) = %08b, want %08b", cpus, mask, want)
	}
	if decoded := cpusInMask(mask); !slices.Equal(decoded, cpus) {
		t.Fatalf("cpusInMask() = %v, want %v", decoded, cpus)
	}
}
