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
	"encoding/binary"
	"fmt"
	"net/netip"
	"slices"
	"strconv"
	"sync"
)

// Every guest sees the same addresses; namespaces keep them apart. Restore and
// fork therefore never rewrite guest network identity.
const (
	GuestIP         = "10.0.0.2"
	GatewayIP       = "10.0.0.1"
	GuestNetmask    = "255.255.255.252"
	GuestMAC        = "06:00:0a:00:00:02"
	TAPName         = "tap0"
	guestPrefixBits = 30

	// VethPrefix names the host end of every sandbox veth pair.
	VethPrefix       = "sfh"
	namespacePrefix  = "sf-"
	namespaceUplink  = "uplink"
	defaultResolver  = "1.1.1.1"
	defaultTransit   = "100.79.0.0/16"
	transitPairBits  = 31
	slotBase         = 16
	ipv4Bits         = 32
	addressesPerSlot = 2
)

// NamespaceName is the network namespace of an instance.
func NamespaceName(instanceID string) string { return namespacePrefix + instanceID }

func allocationFor(instanceID string, slot int, transit netip.Prefix, dns string) (Allocation, error) {
	host, sandbox, err := transitPair(transit, slot)
	if err != nil {
		return Allocation{}, err
	}
	return Allocation{
		Slot:           slot,
		Namespace:      NamespaceName(instanceID),
		HostVeth:       VethPrefix + strconv.FormatInt(int64(slot), slotBase),
		TransitHost:    host.String(),
		TransitSandbox: sandbox.String(),
		TAPDevice:      TAPName,
		IP:             GuestIP,
		MAC:            GuestMAC,
		Gateway:        GatewayIP,
		Netmask:        GuestNetmask,
		DNS:            dns,
	}, nil
}

func transitPair(transit netip.Prefix, slot int) (netip.Addr, netip.Addr, error) {
	if slot < 0 || slot >= slotCapacity(transit) {
		return netip.Addr{}, netip.Addr{}, fmt.Errorf("transit slot %d is outside %s", slot, transit)
	}
	base := transit.Masked().Addr().As4()
	var host [4]byte
	binary.BigEndian.PutUint32(host[:], binary.BigEndian.Uint32(base[:])+uint32(slot*addressesPerSlot))
	address := netip.AddrFrom4(host)
	return address, address.Next(), nil
}

func slotCapacity(transit netip.Prefix) int {
	if !transit.Addr().Is4() || transit.Bits() > transitPairBits {
		return 0
	}
	return 1 << (ipv4Bits - transit.Bits() - 1)
}

// slotRegistry hands out transit slots; instance metadata is the durable
// record, so the registry is rebuilt from it on reconcile.
type slotRegistry struct {
	mu       sync.Mutex
	capacity int
	byID     map[string]int
}

func newSlotRegistry(capacity int) *slotRegistry {
	return &slotRegistry{capacity: capacity, byID: make(map[string]int)}
}

func (registry *slotRegistry) reserve(id string) (int, error) {
	registry.mu.Lock()
	defer registry.mu.Unlock()
	if slot, ok := registry.byID[id]; ok {
		return slot, nil
	}
	used := make([]bool, registry.capacity)
	for _, slot := range registry.byID {
		used[slot] = true
	}
	slot := slices.Index(used, false)
	if slot < 0 {
		return 0, fmt.Errorf("all %d sandbox network slots are in use", registry.capacity)
	}
	registry.byID[id] = slot
	return slot, nil
}

func (registry *slotRegistry) release(id string) {
	registry.mu.Lock()
	defer registry.mu.Unlock()
	delete(registry.byID, id)
}

func (registry *slotRegistry) replace(allocations map[string]Allocation) error {
	registry.mu.Lock()
	defer registry.mu.Unlock()
	byID := make(map[string]int, len(allocations))
	owners := make(map[int]string, len(allocations))
	for id, allocation := range allocations {
		if allocation.Slot < 0 || allocation.Slot >= registry.capacity {
			return fmt.Errorf("instance %s holds transit slot %d outside the configured range", id, allocation.Slot)
		}
		if owner, taken := owners[allocation.Slot]; taken {
			return fmt.Errorf("instances %s and %s hold the same transit slot %d", owner, id, allocation.Slot)
		}
		owners[allocation.Slot] = id
		byID[id] = allocation.Slot
	}
	registry.byID = byID
	return nil
}
