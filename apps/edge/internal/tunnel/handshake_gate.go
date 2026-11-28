// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tunnel

import (
	"context"
	"errors"
	"net"
	"net/netip"
	"sync"

	"github.com/snapflowio/tunnel-go/transport"
)

const (
	maxConcurrentTunnelHandshakes = 256
	maxTunnelHandshakesPerIP      = 8
)

var errTunnelHandshakeCapacity = errors.New("tunnel handshake capacity reached")

type handshakeGate struct {
	slots    chan struct{}
	maxPerIP int

	mu    sync.Mutex
	perIP map[netip.Addr]int
}

type handshakeReservation struct {
	gate *handshakeGate
	ip   netip.Addr
	once sync.Once
}

type handshakeReservationContextKey struct{}

func newHandshakeGate(maxConcurrent, maxPerIP int) (*handshakeGate, error) {
	if maxConcurrent < 1 || maxPerIP < 1 || maxPerIP > maxConcurrent {
		return nil, errors.New("invalid tunnel handshake limits")
	}
	return &handshakeGate{
		slots:    make(chan struct{}, maxConcurrent),
		maxPerIP: maxPerIP,
		perIP:    make(map[netip.Addr]int),
	}, nil
}

func (gate *handshakeGate) Admit(
	parent context.Context,
	client transport.ClientInfo,
) (context.Context, error) {
	if !client.AddressVerified {
		return nil, errors.New("tunnel client address is not verified")
	}
	ip, err := remoteIP(client.RemoteAddr)
	if err != nil {
		return nil, err
	}
	reservation, admitted := gate.reserve(ip)
	if !admitted {
		return nil, errTunnelHandshakeCapacity
	}
	ctx := context.WithValue(
		parent,
		handshakeReservationContextKey{},
		reservation,
	)
	context.AfterFunc(ctx, reservation.release)
	return ctx, nil
}

func (gate *handshakeGate) reserve(ip netip.Addr) (*handshakeReservation, bool) {
	gate.mu.Lock()
	defer gate.mu.Unlock()
	if gate.perIP[ip] >= gate.maxPerIP {
		return nil, false
	}
	select {
	case gate.slots <- struct{}{}:
		gate.perIP[ip]++
		return &handshakeReservation{gate: gate, ip: ip}, true
	default:
		return nil, false
	}
}

func (reservation *handshakeReservation) release() {
	if reservation == nil || reservation.gate == nil {
		return
	}
	reservation.once.Do(func() {
		gate := reservation.gate
		gate.mu.Lock()
		if count := gate.perIP[reservation.ip]; count <= 1 {
			delete(gate.perIP, reservation.ip)
		} else {
			gate.perIP[reservation.ip] = count - 1
		}
		<-gate.slots
		gate.mu.Unlock()
	})
}

func releaseHandshake(session *transport.Session) {
	reservation, valid := session.Context().Value(
		handshakeReservationContextKey{},
	).(*handshakeReservation)
	if !valid || reservation == nil {
		return
	}
	reservation.release()
}

func remoteIP(address net.Addr) (netip.Addr, error) {
	if address == nil {
		return netip.Addr{}, errors.New("tunnel client address is required")
	}
	host, _, err := net.SplitHostPort(address.String())
	if err != nil {
		return netip.Addr{}, errors.New("tunnel client address is invalid")
	}
	ip, err := netip.ParseAddr(host)
	if err != nil {
		return netip.Addr{}, errors.New("tunnel client IP address is invalid")
	}
	return ip.Unmap(), nil
}
