// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package udp

import (
	"errors"
	"net"
	"net/netip"
	"time"

	"github.com/snapflowio/edge/internal/admit"
	"github.com/snapflowio/edge/internal/proxy"
	"github.com/snapflowio/edge/internal/routes"
)

const packetsPerDatagram = 1

var (
	errPacketRate      = errors.New("machine UDP packet rate exceeded")
	errInvalidSource   = errors.New("machine UDP source address is invalid")
	errSourceAdmission = errors.New("machine UDP source admission rejected")
	errRouteLease      = errors.New("machine UDP route lease is unavailable")
	errDatagramSize    = errors.New("machine UDP application datagram exceeds its route limit")
	errRouteDraining   = errors.New("machine UDP route is draining")
	errFlowAdmission   = errors.New("machine UDP flow admission rejected")
	errFlowCapacity    = errors.New("machine UDP flow capacity reached")
)

func (worker *socketWorker) forward(
	peer *net.UDPAddr,
	payload []byte,
	now time.Time,
) error {
	if !worker.group.allowPacket(now) {
		return errPacketRate
	}
	source, valid := proxy.SourceAddress(peer)
	if !valid {
		return errInvalidSource
	}
	worker.mu.Lock()
	route, active, err := worker.flowForLocked(peer, source, len(payload), now)
	worker.mu.Unlock()
	if err != nil {
		return err
	}
	active.requestBytes.Add(uint64(len(payload)))
	if err := worker.parent.send(route.Base, active.key.flowID, payload); err != nil {
		return err
	}
	active.usage.AddIngress(uint64(len(payload)), packetsPerDatagram)
	active.lastClientAt.Store(now.UnixNano())
	return nil
}

func (worker *socketWorker) flowForLocked(
	peer *net.UDPAddr,
	source netip.AddrPort,
	payloadSize int,
	now time.Time,
) (routes.UDP, *peerFlow, error) {
	key := peer.String()
	existing := worker.flows[key]
	if worker.parent.admission.AllowUDP(source.Addr(), existing == nil) != admit.ResultAllowed {
		return routes.UDP{}, nil, errSourceAdmission
	}
	route, exists := worker.parent.routes.Load().UDPExisting(worker.port, now)
	if !exists || route.BackendID != worker.backendID {
		return routes.UDP{}, nil, errRouteLease
	}
	if payloadSize > route.Policy.MaxDatagramPayloadBytes {
		return routes.UDP{}, nil, errDatagramSize
	}
	if existing != nil {
		return route, existing, nil
	}
	created, err := worker.openFlowLocked(route, peer, source, now)
	if err != nil {
		return routes.UDP{}, nil, err
	}
	worker.flows[key] = created
	return route, created, nil
}

func (worker *socketWorker) openFlowLocked(
	route routes.UDP,
	peer *net.UDPAddr,
	source netip.AddrPort,
	now time.Time,
) (*peerFlow, error) {
	if !route.AcceptsNew(now) {
		return nil, errRouteDraining
	}
	permit, result := worker.parent.admission.AdmitUDPFlow(
		source.Addr(),
		admit.RouteScope(route.Base),
	)
	if result != admit.ResultAllowed {
		return nil, errFlowAdmission
	}
	if !worker.group.reserveFlow() {
		permit.Release()
		return nil, errFlowCapacity
	}
	counter := worker.parent.meter.OpenCounter(route.BackendID)
	created, err := worker.newFlow(route, peer, permit, counter)
	if err != nil {
		counter.Close()
		worker.group.releaseFlow()
		permit.Release()
		return nil, err
	}
	counter.AddFlow()
	return created, nil
}
