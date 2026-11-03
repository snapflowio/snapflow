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

package guestmemory

import (
	"strings"
	"testing"
)

func TestPolicyKernelArgs(t *testing.T) {
	policy := DefaultPolicy()
	args := stringsJoin(policy.KernelArgs())
	if args != "init_on_alloc=1 init_on_free=0" {
		t.Fatalf("unexpected hardened args %q", args)
	}

	policy.KernelPageInitMode = KernelPageInitPerformance
	args = stringsJoin(policy.KernelArgs())
	if args != "init_on_alloc=0 init_on_free=0" {
		t.Fatalf("unexpected performance args %q", args)
	}
}

func TestMergeKernelArgsDeduplicatesLastWriteWins(t *testing.T) {
	merged := MergeKernelArgs("console=ttyS0 init_on_alloc=1 panic=1", "init_on_alloc=0 init_on_free=0")
	if merged != "console=ttyS0 init_on_alloc=0 panic=1 init_on_free=0" {
		t.Fatalf("unexpected merged args %q", merged)
	}
}

func TestDisabledPolicyDisablesReclaimFeatures(t *testing.T) {
	policy := DefaultPolicy()
	policy.Enabled = false
	features := policy.Features()
	if features.EnableBalloon || features.DeflateOnOOM || features.FreePageReporting || features.FreePageHinting {
		t.Fatalf("expected disabled features, got %#v", features)
	}
}

func stringsJoin(values []string) string {
	return strings.Join(values, " ")
}
