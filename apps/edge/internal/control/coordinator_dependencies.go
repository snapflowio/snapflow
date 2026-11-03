// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package control

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/edge/internal/telemetry"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

type API interface {
	Routes(context.Context, string) (RouteRead, error)
	Heartbeat(context.Context, apiclient.EdgeHeartbeatDto) (*apiclient.EdgeHeartbeatResponseDto, error)
}

type RouteStore interface {
	Load() *routes.Snapshot
	Apply(*apiclient.EdgeRouteSnapshotDto) error
	RecordRefreshFailure()
}

type HostSampler interface {
	Sample() (telemetry.HostSample, error)
}

type Capacity interface {
	Ready() bool
	SessionCount() int32
	TCPConnectionCount() int32
	FlowCount() int32
	OperationalMetrics() OperationalMetrics
}

type Bindings interface {
	BindingAcknowledgements() []apiclient.EdgeBindingAcknowledgementDto
	BindingAcknowledgementChanges() <-chan struct{}
}

type AccessSessions interface {
	ReportAccessSessions() []uuid.UUID
	ConfirmAccessSession(uuid.UUID, time.Time)
	RevokeAccessSessions([]uuid.UUID)
}

type Listeners interface {
	ListenerStatuses() []apiclient.EdgeRouteListenerStatusDto
}

type Status interface {
	Capacity
	Bindings
	AccessSessions
	Listeners
}

type OperationalMetrics struct {
	RouteCount                  int
	TunnelHeadroom              int
	HTTPRequests                int32
	HTTPRequestHeadroom         int
	HTTPConnections             int32
	HTTPConnectionHeadroom      int
	HTTPStreams                 int32
	HTTPStreamHeadroom          int
	TCPConnectionHeadroom       int
	UDPFlowHeadroom             int
	AdmissionRateRejections     uint64
	AdmissionCapacityRejections uint64
	AdmissionDrainRejections    uint64
	SourceAdmissionEntries      int
	SourceAdmissionEvictions    uint64
	DatagramsDelivered          uint64
	DatagramsDropped            uint64
	DatagramsFailed             uint64
}
