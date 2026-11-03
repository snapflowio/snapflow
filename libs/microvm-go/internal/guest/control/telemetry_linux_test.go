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

package control

import (
	"os"
	"path/filepath"
	"testing"
)

func TestReadCPUTicks(t *testing.T) {
	path := writeTelemetryFixture(t, "cpu  100 20 30 400 50 6 7 8 0 0\n")
	total, busy, err := readCPUTicks(path)
	if err != nil {
		t.Fatal(err)
	}
	if total != 621 || busy != 171 {
		t.Fatalf("CPU counters = total %d busy %d, want total 621 busy 171", total, busy)
	}
}

func TestReadMemoryBytes(t *testing.T) {
	path := writeTelemetryFixture(t, "MemTotal:       16384 kB\nMemAvailable:    4096 kB\n")
	total, used, err := readMemoryBytes(path)
	if err != nil {
		t.Fatal(err)
	}
	if total != 16*1024*1024 || used != 12*1024*1024 {
		t.Fatalf("memory counters = total %d used %d", total, used)
	}
}

func TestReadNetworkBytesExcludesLoopback(t *testing.T) {
	path := writeTelemetryFixture(t, `Inter-| Receive | Transmit
 lo: 100 0 0 0 0 0 0 0 200 0 0 0 0 0 0 0
eth0: 300 0 0 0 0 0 0 0 400 0 0 0 0 0 0 0
eth1: 500 0 0 0 0 0 0 0 600 0 0 0 0 0 0 0
`)
	receive, transmit, err := readNetworkBytes(path)
	if err != nil {
		t.Fatal(err)
	}
	if receive != 800 || transmit != 1000 {
		t.Fatalf("network counters = receive %d transmit %d", receive, transmit)
	}
}

func writeTelemetryFixture(t *testing.T, content string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "fixture")
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}
