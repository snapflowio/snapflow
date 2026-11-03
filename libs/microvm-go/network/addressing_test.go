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

package network

import (
	"net/netip"
	"testing"
)

func TestAllocationsShareGuestAddressingAndSplitTransit(t *testing.T) {
	transit := netip.MustParsePrefix(defaultTransit)
	first, err := allocationFor("a", 0, transit, defaultResolver)
	if err != nil {
		t.Fatal(err)
	}
	second, err := allocationFor("b", 1, transit, defaultResolver)
	if err != nil {
		t.Fatal(err)
	}
	if first.IP != second.IP || first.MAC != second.MAC || first.TAPDevice != second.TAPDevice {
		t.Fatalf("guest addressing differs: %+v %+v", first, second)
	}
	if first.TransitHost != "100.79.0.0" || first.TransitSandbox != "100.79.0.1" || second.TransitHost != "100.79.0.2" {
		t.Fatalf("unexpected transit pairs: %+v %+v", first, second)
	}
	if first.HostVeth == second.HostVeth || len(first.HostVeth) > 15 {
		t.Fatalf("host veth names must be unique and fit IFNAMSIZ: %q %q", first.HostVeth, second.HostVeth)
	}
	if _, err := allocationFor("c", slotCapacity(transit), transit, defaultResolver); err == nil {
		t.Fatal("a slot beyond the transit range was accepted")
	}
}

func TestSlotRegistryReusesFreedSlotsAndRejectsConflicts(t *testing.T) {
	registry := newSlotRegistry(2)
	first, err := registry.reserve("a")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := registry.reserve("b"); err != nil {
		t.Fatal(err)
	}
	if _, err := registry.reserve("c"); err == nil {
		t.Fatal("a full registry handed out a slot")
	}
	registry.release("a")
	if slot, err := registry.reserve("c"); err != nil || slot != first {
		t.Fatalf("reserve after release = %d, %v; want %d", slot, err, first)
	}
	conflict := map[string]Allocation{"x": {Slot: 0}, "y": {Slot: 0}}
	if err := registry.replace(conflict); err == nil {
		t.Fatal("conflicting slots were accepted")
	}
}
