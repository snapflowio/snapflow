// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the license at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

//go:build linux

package network

import (
	"os"
	"testing"
)

const isolationTestEnvironment = "SNAPFLOW_ISOLATION_TEST"

func TestSandboxNamespaceIsolatesTheGuest(t *testing.T) {
	if os.Getenv(isolationTestEnvironment) == "" || os.Geteuid() != 0 {
		t.Skipf("needs root and %s=1", isolationTestEnvironment)
	}
	outcomes, err := ProbeIsolation(t.Context(), DefaultConfig())
	if err != nil {
		t.Fatalf("isolation probe: %v", err)
	}
	expected := []string{
		BoundaryInternet, BoundaryHostLAN, BoundaryHostTransit, BoundaryGateway,
		BoundaryOtherSandbox, BoundaryLinkedPeer, BoundarySpoofedIP, BoundarySpoofedMAC,
	}
	if len(outcomes) != len(expected) {
		t.Fatalf("probe tested %d boundaries, want %d", len(outcomes), len(expected))
	}
	for index, outcome := range outcomes {
		if outcome.Boundary != expected[index] {
			t.Errorf("boundary %d is %s, want %s", index, outcome.Boundary, expected[index])
		}
		if !outcome.Held() {
			t.Errorf("%s boundary (%s): %v", outcome.Boundary, outcome.Target, outcome.Err)
		}
	}
}
