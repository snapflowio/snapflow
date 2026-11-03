// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package routes

import (
	"fmt"
	"net/netip"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/tunnel-go/protocol"
)

type Snapshot struct {
	version                  string
	digest                   string
	generatedAt              time.Time
	expiresAt                time.Time
	httpByHost               map[string][]HTTP
	tcpByPort                map[uint16]TCP
	udpByPort                map[uint16]UDP
	routeByBackend           map[uuid.UUID]Base
	protocolByBackend        map[uuid.UUID]protocol.Protocol
	machineBindings          map[uuid.UUID]MachineBinding
	assignmentGenerations    map[string]uint32
	trustedHTTPProxyPrefixes []netip.Prefix
	rejectedRoutes           []Rejection
}

type Rejection struct {
	Protocol  protocol.Protocol
	BackendID string
	Reason    error
}

func emptySnapshot() *Snapshot {
	return &Snapshot{
		httpByHost:            make(map[string][]HTTP),
		tcpByPort:             make(map[uint16]TCP),
		udpByPort:             make(map[uint16]UDP),
		routeByBackend:        make(map[uuid.UUID]Base),
		protocolByBackend:     make(map[uuid.UUID]protocol.Protocol),
		machineBindings:       make(map[uuid.UUID]MachineBinding),
		assignmentGenerations: make(map[string]uint32),
	}
}

func (snapshot *Snapshot) Digest() string {
	if snapshot == nil {
		return ""
	}
	return snapshot.digest
}

func (snapshot *Snapshot) Version() string {
	if snapshot == nil {
		return ""
	}
	return snapshot.version
}

func (snapshot *Snapshot) BackendCount() int {
	if snapshot == nil {
		return 0
	}
	return len(snapshot.routeByBackend)
}

func (snapshot *Snapshot) RejectedRoutes() []Rejection {
	if snapshot == nil {
		return nil
	}
	return snapshot.rejectedRoutes
}

func (snapshot *Snapshot) reject(routeProtocol protocol.Protocol, backendID string, reason error) {
	snapshot.rejectedRoutes = append(snapshot.rejectedRoutes, Rejection{
		Protocol:  routeProtocol,
		BackendID: backendID,
		Reason:    reason,
	})
}

func (snapshot *Snapshot) isCurrent(now time.Time) bool {
	return snapshot != nil && now.Before(snapshot.expiresAt)
}

func (snapshot *Snapshot) addBase(
	route Base,
	routeProtocol protocol.Protocol,
) error {
	binding, exists := snapshot.machineBindings[route.MachineID]
	if !exists || binding.Binding.ID != route.BindingID {
		return fmt.Errorf(
			"backend %s references an unavailable Machine binding",
			route.BackendID,
		)
	}
	if route.LeaseExpiresAt.After(binding.ExpiresAt) {
		return fmt.Errorf(
			"backend %s lease outlives its Machine binding",
			route.BackendID,
		)
	}
	if _, exists := snapshot.routeByBackend[route.BackendID]; exists {
		return fmt.Errorf("duplicate backend %s", route.BackendID)
	}
	generation, exists := snapshot.assignmentGenerations[route.SandboxID]
	if exists && generation != route.AssignmentGeneration {
		return fmt.Errorf(
			"sandbox %s has inconsistent assignment generations %d and %d",
			route.SandboxID,
			generation,
			route.AssignmentGeneration,
		)
	}
	snapshot.assignmentGenerations[route.SandboxID] = route.AssignmentGeneration
	snapshot.routeByBackend[route.BackendID] = route
	snapshot.protocolByBackend[route.BackendID] = routeProtocol
	return nil
}
