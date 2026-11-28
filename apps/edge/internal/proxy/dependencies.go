// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package proxy

import (
	"context"
	"net/netip"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/edge/internal/traffic"
	"github.com/snapflowio/tunnel-go/protocol"
	"github.com/snapflowio/tunnel-go/transport"
)

type Routes interface {
	Load() *routes.Snapshot
}

type RouteUpdates interface {
	Routes
	Updates() <-chan struct{}
}

type Meter interface {
	OpenCounter(backendID uuid.UUID) *traffic.Counter
}

type Streams interface {
	OpenStream(
		ctx context.Context,
		route routes.Base,
		routeProtocol protocol.Protocol,
		source netip.AddrPort,
	) (transport.Stream, error)
}
