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

package volumeartifact

import (
	"os"
	"syscall"
	"testing"
)

const statBlockBytes = 512

func assertSparse(t *testing.T, path string, maxAllocatedBytes int64) {
	t.Helper()
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	stat, ok := info.Sys().(*syscall.Stat_t)
	if !ok {
		t.Fatal("restored volume has no Linux stat data")
	}
	if allocated := stat.Blocks * statBlockBytes; allocated > maxAllocatedBytes {
		t.Fatalf("restored volume allocates %d bytes, want at most %d", allocated, maxAllocatedBytes)
	}
}
