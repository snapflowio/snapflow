// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package plan

import (
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/common-go/pkg/guestspec"
	"github.com/snapflowio/tunnel-go/protocol"
)

const (
	RuntimeTargetHost    = "runtime"
	BuildLogsTargetHost  = "machine-build-logs"
	SSHGatewayTargetHost = "machine-ssh-gateway"
)

func relayedGuestServices() map[string]struct{} {
	return map[string]struct{}{
		guestspec.ToolboxService:  {},
		guestspec.TerminalService: {},
		guestspec.DesktopService:  {},
	}
}

const (
	maximumTunnelBindings        = 20_000
	maximumTunnelTargets         = 10_000
	maximumHostnameLength        = 253
	maximumPlanLifetime          = time.Minute
	maximumTargetReferenceLength = 512
	javaScriptISOTime            = "2006-01-02T15:04:05.000Z"
	minimumPort                  = 1
	maximumPort                  = 65_535
)

type TargetState string

const (
	TargetPending  TargetState = "pending"
	TargetActive   TargetState = "active"
	TargetDraining TargetState = "draining"
)

type BindingState string

const (
	BindingActive   BindingState = "active"
	BindingDraining BindingState = "draining"
)

type Target struct {
	BackendID                 uuid.UUID         `json:"backendId"`
	ExposureID                uuid.UUID         `json:"exposureId"`
	ExposureGeneration        uint32            `json:"exposureGeneration"`
	SandboxID                 string            `json:"sandboxId"`
	AssignmentGeneration      uint32            `json:"assignmentGeneration"`
	PlacementFencingTokenHash string            `json:"placementFencingTokenHash"`
	Protocol                  protocol.Protocol `json:"protocol"`
	Port                      uint16            `json:"port"`
	Host                      string            `json:"host"`
	Reference                 string            `json:"reference,omitempty"`
	GuestService              string            `json:"guestService,omitempty"`
	State                     TargetState       `json:"state"`
	LeaseExpiresAt            time.Time         `json:"leaseExpiresAt"`
}

func (target Target) acceptsNew() bool {
	return target.State == TargetPending || target.State == TargetActive
}

type Binding struct {
	EdgeID         uuid.UUID
	Address        string
	ServerName     string
	Identity       protocol.Binding
	TargetRevision uint64
	TargetDigest   string
	DesiredState   BindingState
	LeaseExpiresAt time.Time
	Targets        map[uuid.UUID]Target
}

func (binding Binding) SameConnection(other Binding) bool {
	return binding.EdgeID == other.EdgeID &&
		binding.Address == other.Address &&
		binding.ServerName == other.ServerName &&
		binding.Identity == other.Identity
}

type Plan struct {
	MachineID                uuid.UUID
	MachineSessionGeneration uint32
	Version                  uint64
	Digest                   string
	GeneratedAt              time.Time
	ExpiresAt                time.Time
	Bindings                 map[uuid.UUID]Binding
}

func (plan Plan) ValidAt(now time.Time) bool {
	return !plan.ExpiresAt.IsZero() && now.Before(plan.ExpiresAt)
}

func (plan Plan) TargetFor(
	binding protocol.Binding,
	backendID uuid.UUID,
	generation uint32,
	now time.Time,
) (Target, bool) {
	current, exists := plan.Bindings[binding.ID]
	if !exists || current.Identity != binding || current.DesiredState != BindingActive ||
		!now.Before(current.LeaseExpiresAt) {
		return Target{}, false
	}
	target, exists := current.Targets[backendID]
	return target, exists && target.AssignmentGeneration == generation &&
		target.acceptsNew() && now.Before(target.LeaseExpiresAt)
}
