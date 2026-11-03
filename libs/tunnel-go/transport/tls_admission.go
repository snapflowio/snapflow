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

package transport

import (
	"crypto/tls"
	"errors"
	"log/slog"
	"net"
	"net/netip"
	"sync"
)

type tlsAdmissionListener struct {
	net.Listener
	tlsConfig *tls.Config
	slots     chan struct{}
	maxPerIP  int

	mu           sync.Mutex
	perIP        map[netip.Addr]int
	reservations sync.Map
}

type tlsAdmissionReservation struct {
	listener *tlsAdmissionListener
	ip       netip.Addr
	once     sync.Once
}

func newTLSAdmissionListener(
	listener net.Listener,
	tlsConfig *tls.Config,
	maxConcurrent int,
	maxPerIP int,
) (*tlsAdmissionListener, error) {
	if listener == nil || tlsConfig == nil ||
		maxConcurrent < 1 || maxPerIP < 1 || maxPerIP > maxConcurrent {
		return nil, errors.New("invalid fallback TLS admission settings")
	}
	return &tlsAdmissionListener{
		Listener:  listener,
		tlsConfig: tlsConfig,
		slots:     make(chan struct{}, maxConcurrent),
		maxPerIP:  maxPerIP,
		perIP:     make(map[netip.Addr]int),
	}, nil
}

func (listener *tlsAdmissionListener) Accept() (net.Conn, error) {
	for {
		connection, err := listener.Listener.Accept()
		if err != nil {
			return nil, err
		}
		ip, err := tlsSourceIP(connection.RemoteAddr())
		if err != nil {
			closeTLSAdmissionConnection(connection, "invalid source address")
			continue
		}
		reservation, accepted := listener.reserve(ip)
		if !accepted {
			closeTLSAdmissionConnection(connection, "handshake capacity reached")
			continue
		}
		secured := tls.Server(connection, listener.tlsConfig)
		listener.reservations.Store(secured, reservation)
		return secured, nil
	}
}

func (listener *tlsAdmissionListener) reserve(
	ip netip.Addr,
) (*tlsAdmissionReservation, bool) {
	listener.mu.Lock()
	defer listener.mu.Unlock()
	if listener.perIP[ip] >= listener.maxPerIP {
		return nil, false
	}
	select {
	case listener.slots <- struct{}{}:
		listener.perIP[ip]++
		return &tlsAdmissionReservation{listener: listener, ip: ip}, true
	default:
		return nil, false
	}
}

func (listener *tlsAdmissionListener) release(connection net.Conn) {
	value, exists := listener.reservations.LoadAndDelete(connection)
	if !exists {
		return
	}
	reservation, valid := value.(*tlsAdmissionReservation)
	if valid {
		reservation.release()
	}
}

func (reservation *tlsAdmissionReservation) release() {
	if reservation == nil || reservation.listener == nil {
		return
	}
	reservation.once.Do(func() {
		listener := reservation.listener
		listener.mu.Lock()
		if count := listener.perIP[reservation.ip]; count <= 1 {
			delete(listener.perIP, reservation.ip)
		} else {
			listener.perIP[reservation.ip] = count - 1
		}
		<-listener.slots
		listener.mu.Unlock()
	})
}

func tlsSourceIP(address net.Addr) (netip.Addr, error) {
	if address == nil {
		return netip.Addr{}, errors.New("source address is required")
	}
	host, _, err := net.SplitHostPort(address.String())
	if err != nil {
		return netip.Addr{}, err
	}
	ip, err := netip.ParseAddr(host)
	if err != nil {
		return netip.Addr{}, err
	}
	return ip.Unmap(), nil
}

func closeTLSAdmissionConnection(connection net.Conn, reason string) {
	if err := connection.Close(); err != nil && !errors.Is(err, net.ErrClosed) {
		slog.Debug(
			"rejected fallback TLS connection did not close cleanly",
			"reason",
			reason,
			"error",
			err,
		)
	}
}
