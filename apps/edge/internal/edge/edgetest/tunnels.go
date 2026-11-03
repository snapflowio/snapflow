// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package edgetest

import (
	"context"
	"errors"
	"net"
	"net/netip"
	"sync"

	"github.com/snapflowio/edge/internal/edge"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/edge/internal/tunnel"
	"github.com/snapflowio/tunnel-go/protocol"
	"github.com/snapflowio/tunnel-go/transport"
)

const tcpNetwork = "tcp"

var ErrDatagramsUnsupported = errors.New("the test tunnels do not carry UDP datagrams")

var _ edge.Tunnels = (*Tunnels)(nil)

type Tunnels struct {
	mu       sync.Mutex
	backends map[uuid.UUID]string
	opened   int
	dialer   net.Dialer
	changes  chan struct{}
}

func newTunnels(routeSpecs []Route) *Tunnels {
	backends := make(map[uuid.UUID]string, len(routeSpecs))
	for _, route := range routeSpecs {
		backends[route.BackendID] = route.Backend
	}
	return &Tunnels{backends: backends, changes: make(chan struct{})}
}

func (tunnels *Tunnels) Run(ctx context.Context) error {
	<-ctx.Done()
	return nil
}

func (tunnels *Tunnels) BeginDrain() {}

func (tunnels *Tunnels) OpenStream(
	ctx context.Context,
	route routes.Base,
	routeProtocol protocol.Protocol,
	source netip.AddrPort,
) (transport.Stream, error) {
	tunnels.mu.Lock()
	backend, found := tunnels.backends[route.BackendID]
	if found {
		tunnels.opened++
	}
	tunnels.mu.Unlock()
	if !found {
		return nil, tunnel.ErrMachineUnavailable
	}
	return tunnels.dialer.DialContext(ctx, tcpNetwork, backend)
}

func (tunnels *Tunnels) OpenedStreams() int {
	tunnels.mu.Lock()
	defer tunnels.mu.Unlock()
	return tunnels.opened
}

func (tunnels *Tunnels) BackendLoad(route routes.Base) (int64, bool) {
	tunnels.mu.Lock()
	defer tunnels.mu.Unlock()
	_, found := tunnels.backends[route.BackendID]
	return 0, found
}

func (tunnels *Tunnels) SendUDP(routes.Base, uint64, []byte) error {
	return ErrDatagramsUnsupported
}

func (tunnels *Tunnels) SessionCount() int32 { return 0 }

func (tunnels *Tunnels) SessionHeadroom() int32 { return 0 }

func (tunnels *Tunnels) BindingAcknowledgements() []tunnel.BindingAcknowledgement { return nil }

func (tunnels *Tunnels) BindingAcknowledgementChanges() <-chan struct{} { return tunnels.changes }

func (tunnels *Tunnels) DatagramCounters() tunnel.DatagramCounters { return tunnel.DatagramCounters{} }

func (tunnels *Tunnels) TunnelCounters() tunnel.TunnelCounters { return tunnel.TunnelCounters{} }
