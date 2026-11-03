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
	"errors"
	"net"
	"net/netip"
	"testing"
)

func TestListenTransportSocketsUsesOneEphemeralPort(t *testing.T) {
	t.Parallel()

	packetConn, tcpListener, err := listenTransportSockets(t.Context(), "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen on an ephemeral tunnel port: %v", err)
	}
	t.Cleanup(func() {
		if err := errors.Join(packetConn.Close(), tcpListener.Close()); err != nil {
			t.Errorf("close ephemeral tunnel listeners: %v", err)
		}
	})

	udpPort := netip.MustParseAddrPort(packetConn.LocalAddr().String()).Port()
	tcpPort := netip.MustParseAddrPort(tcpListener.Addr().String()).Port()
	if udpPort == 0 || udpPort != tcpPort {
		t.Fatalf("TCP port %d and UDP port %d do not match", tcpPort, udpPort)
	}
}

func TestListenTransportSocketsClosesTCPAfterFixedUDPBindFailure(t *testing.T) {
	t.Parallel()

	occupiedUDP, err := net.ListenUDP(
		"udp",
		&net.UDPAddr{IP: net.ParseIP("127.0.0.1")},
	)
	if err != nil {
		t.Fatalf("reserve UDP port: %v", err)
	}
	t.Cleanup(func() {
		if err := occupiedUDP.Close(); err != nil {
			t.Errorf("close reserved UDP port: %v", err)
		}
	})
	address := occupiedUDP.LocalAddr().String()

	packetConn, tcpListener, err := listenTransportSockets(t.Context(), address)
	if err == nil {
		var closeErr error
		if packetConn != nil {
			closeErr = errors.Join(closeErr, packetConn.Close())
		}
		if tcpListener != nil {
			closeErr = errors.Join(closeErr, tcpListener.Close())
		}
		if closeErr != nil {
			t.Errorf("close unexpectedly live tunnel listeners: %v", closeErr)
		}
		t.Fatal("expected the occupied UDP port to reject the tunnel listener")
	}
	if packetConn != nil || tcpListener != nil {
		t.Fatal("failed tunnel bind returned live sockets")
	}

	var listenerConfig net.ListenConfig
	reboundTCP, err := listenerConfig.Listen(t.Context(), "tcp", address)
	if err != nil {
		t.Fatalf("TCP listener leaked after UDP bind failure: %v", err)
	}
	if err := reboundTCP.Close(); err != nil {
		t.Fatalf("close rebound TCP listener: %v", err)
	}
}
