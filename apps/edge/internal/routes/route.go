// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package routes

import (
	"slices"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/tunnel-go/protocol"
)

type BackendState string

const (
	BackendPending  BackendState = "pending"
	BackendActive   BackendState = "active"
	BackendDraining BackendState = "draining"
)

type ProxyProtocol string

const (
	ProxyProtocolDisabled ProxyProtocol = "disabled"
	ProxyProtocolV2       ProxyProtocol = "v2"
)

type HTTPVisibility string

const (
	HTTPVisibilityProtected HTTPVisibility = "protected"
	HTTPVisibilityPublic    HTTPVisibility = "public"
)

type HTTPUpstreamProtocol string

const (
	HTTPUpstreamHTTP1 HTTPUpstreamProtocol = "http"
	HTTPUpstreamH2C   HTTPUpstreamProtocol = "h2c"
)

type Base struct {
	BackendID            uuid.UUID
	MachineID            uuid.UUID
	OwnerID              uuid.UUID
	BindingID            uuid.UUID
	Interactive          bool
	AssignmentGeneration uint32
	ExposureGeneration   uint32
	SandboxID            string
	ExposureID           uuid.UUID
	ExposureName         string
	PublicHost           string
	TargetHost           string
	TargetPort           uint16
	State                BackendState
	LeaseExpiresAt       time.Time
}

func (route Base) AcceptsNew(now time.Time) bool {
	return (route.State == BackendPending || route.State == BackendActive) &&
		now.Before(route.LeaseExpiresAt)
}

func (route Base) Serves(now time.Time) bool {
	return (route.State == BackendPending ||
		route.State == BackendActive ||
		route.State == BackendDraining) &&
		now.Before(route.LeaseExpiresAt)
}

type MachineBinding struct {
	MachineID                uuid.UUID
	MachineSessionGeneration uint32
	Binding                  protocol.Binding
	ExpiresAt                time.Time
}

func (binding MachineBinding) IsActive(now time.Time) bool {
	return now.Before(binding.ExpiresAt)
}

type HTTPPolicy struct {
	Visibility          HTTPVisibility
	Path                string
	StripPath           bool
	ForceHTTPS          bool
	RequireTrustedProxy bool
	MaxBodyBytes        int64
	ReadTimeout         time.Duration
	SendTimeout         time.Duration
	Retries             int
	Streaming           bool
	UpstreamProtocol    HTTPUpstreamProtocol
	AllowedOrigins      []string
	AllowCredentials    bool
	ShowBrowserWarning  bool
}

func (policy HTTPPolicy) Equal(other HTTPPolicy) bool {
	return policy.Visibility == other.Visibility &&
		policy.Path == other.Path &&
		policy.StripPath == other.StripPath &&
		policy.ForceHTTPS == other.ForceHTTPS &&
		policy.RequireTrustedProxy == other.RequireTrustedProxy &&
		policy.MaxBodyBytes == other.MaxBodyBytes &&
		policy.ReadTimeout == other.ReadTimeout &&
		policy.SendTimeout == other.SendTimeout &&
		policy.Retries == other.Retries &&
		policy.Streaming == other.Streaming &&
		policy.UpstreamProtocol == other.UpstreamProtocol &&
		policy.AllowCredentials == other.AllowCredentials &&
		policy.ShowBrowserWarning == other.ShowBrowserWarning &&
		slices.Equal(policy.AllowedOrigins, other.AllowedOrigins)
}

type HTTP struct {
	Base
	Hostnames     []string
	TrafficWeight uint16
	Policy        HTTPPolicy
}

type TCPPolicy struct {
	ProxyProtocol   ProxyProtocol
	IdleTimeout     time.Duration
	ConnectionLimit int
}

type TCP struct {
	Base
	PublicPort uint16
	Policy     TCPPolicy
}

type UDPPolicy struct {
	IdleTimeout             time.Duration
	FlowLimit               int
	PacketsPerSecond        int
	MaxDatagramPayloadBytes int
}

type UDP struct {
	Base
	PublicPort uint16
	Policy     UDPPolicy
}
