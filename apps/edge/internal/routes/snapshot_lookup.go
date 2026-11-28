// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package routes

import (
	"net/netip"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/tunnel-go/protocol"
)

func (snapshot *Snapshot) HTTPRoutes(
	host string,
	path string,
	now time.Time,
) []HTTP {
	if !snapshot.isCurrent(now) {
		return nil
	}
	var selectedPath string
	var result []HTTP
	routes := snapshot.httpByHost[NormalizeHost(host)]
	for _, route := range routes {
		if !route.AcceptsNew(now) ||
			!PathMatches(route.Policy.Path, path) {
			continue
		}
		if selectedPath == "" {
			selectedPath = route.Policy.Path
		}
		if route.Policy.Path != selectedPath {
			break
		}
		result = append(result, route)
	}
	return result
}

func (snapshot *Snapshot) TCP(port uint16, now time.Time) (TCP, bool) {
	if !snapshot.isCurrent(now) {
		return TCP{}, false
	}
	route, exists := snapshot.tcpByPort[port]
	return route, exists && route.AcceptsNew(now)
}

func (snapshot *Snapshot) UDPExisting(port uint16, now time.Time) (UDP, bool) {
	if !snapshot.isCurrent(now) {
		return UDP{}, false
	}
	route, exists := snapshot.udpByPort[port]
	return route, exists && route.Serves(now)
}

func (snapshot *Snapshot) TCPRoutes(now time.Time) []TCP {
	if !snapshot.isCurrent(now) {
		return nil
	}
	result := make([]TCP, 0, len(snapshot.tcpByPort))
	for _, route := range snapshot.tcpByPort {
		if route.AcceptsNew(now) {
			result = append(result, route)
		}
	}
	sort.Slice(result, func(left, right int) bool {
		return result[left].PublicPort < result[right].PublicPort
	})
	return result
}

func (snapshot *Snapshot) UDPListenerRoutes(now time.Time) []UDP {
	if !snapshot.isCurrent(now) {
		return nil
	}
	result := make([]UDP, 0, len(snapshot.udpByPort))
	for _, route := range snapshot.udpByPort {
		if route.Serves(now) {
			result = append(result, route)
		}
	}
	sort.Slice(result, func(left, right int) bool {
		return result[left].PublicPort < result[right].PublicPort
	})
	return result
}

func (snapshot *Snapshot) HasBinding(
	machineID uuid.UUID,
	machineSessionGeneration uint32,
	binding protocol.Binding,
	now time.Time,
) bool {
	if !snapshot.isCurrent(now) {
		return false
	}
	assigned, exists := snapshot.machineBindings[machineID]
	return exists && assigned.IsActive(now) &&
		assigned.MachineSessionGeneration == machineSessionGeneration &&
		assigned.Binding == binding
}

func (snapshot *Snapshot) AcceptsMachineDatagram(
	machineID uuid.UUID,
	machineSessionGeneration uint32,
	binding protocol.Binding,
	backendID uuid.UUID,
	assignmentGeneration uint32,
	now time.Time,
) bool {
	if !snapshot.HasBinding(machineID, machineSessionGeneration, binding, now) {
		return false
	}
	route, exists := snapshot.routeByBackend[backendID]
	return exists && route.MachineID == machineID &&
		route.AssignmentGeneration == assignmentGeneration &&
		!now.After(route.LeaseExpiresAt) &&
		(route.State == BackendPending ||
			route.State == BackendActive ||
			route.State == BackendDraining)
}

func (snapshot *Snapshot) UsageIdentity(
	backendID uuid.UUID,
) (uint32, protocol.Protocol, bool) {
	if snapshot == nil {
		return 0, "", false
	}
	route, exists := snapshot.routeByBackend[backendID]
	if !exists {
		return 0, "", false
	}
	return route.AssignmentGeneration, snapshot.protocolByBackend[backendID], true
}

func (snapshot *Snapshot) TrustsHTTPProxy(address netip.Addr) bool {
	if snapshot == nil || !address.IsValid() {
		return false
	}
	address = address.Unmap()
	for _, prefix := range snapshot.trustedHTTPProxyPrefixes {
		if prefix.Contains(address) {
			return true
		}
	}
	return false
}
