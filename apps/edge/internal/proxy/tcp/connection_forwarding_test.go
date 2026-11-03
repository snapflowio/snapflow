// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tcp

import (
	"bytes"
	"net"
	"net/netip"
	"testing"
	"time"

	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/tunnel-go/proxyproto"
	"github.com/snapflowio/tunnel-go/transport"
)

const testIdleTimeout = time.Minute

type recordingStream struct {
	transport.Stream
	written bytes.Buffer
}

func (stream *recordingStream) Write(payload []byte) (int, error) {
	return stream.written.Write(payload)
}

func proxyRoute(mode routes.ProxyProtocol) routes.TCP {
	return routes.TCP{Policy: routes.TCPPolicy{ProxyProtocol: mode, IdleTimeout: testIdleTimeout}}
}

func TestProxyHeaderIsSentOnlyWhenTheRouteAsksForIt(t *testing.T) {
	t.Parallel()
	client, frontend := net.Pipe()
	defer client.Close()
	defer frontend.Close()
	source := netip.MustParseAddrPort("198.51.100.7:40000")

	disabled := &recordingStream{}
	if err := writeProxyHeader(disabled, proxyRoute(routes.ProxyProtocolDisabled), frontend, source); err != nil {
		t.Fatalf("disabled PROXY protocol: %v", err)
	}
	if disabled.written.Len() != 0 {
		t.Fatal("a PROXY header was sent for a route without PROXY protocol")
	}

	tcpServer := &stubConn{Conn: frontend, local: &net.TCPAddr{IP: net.IPv4zero, Port: 10_022}}
	enabled := &recordingStream{}
	if err := writeProxyHeader(enabled, proxyRoute(routes.ProxyProtocolV2), tcpServer, source); err != nil {
		t.Fatalf("PROXY protocol v2: %v", err)
	}
	destination := netip.MustParseAddrPort("0.0.0.0:10022")
	want, err := proxyproto.EncodeV2(source, destination, proxyproto.TransportStream)
	if err != nil {
		t.Fatalf("encode expected header: %v", err)
	}
	if !bytes.Equal(enabled.written.Bytes(), want) {
		t.Fatal("the PROXY header does not describe the client and the listener port")
	}
}

type stubConn struct {
	net.Conn
	local net.Addr
}

func (connection *stubConn) LocalAddr() net.Addr { return connection.local }

func TestIdleTimeoutConnectionFallsBackToCloseWithoutHalfClose(t *testing.T) {
	t.Parallel()
	client, frontend := net.Pipe()
	defer frontend.Close()
	connection := &idleTimeoutConnection{connection: client, timeout: testIdleTimeout}
	if err := connection.CloseWrite(); err != nil {
		t.Fatalf("close write: %v", err)
	}
	if _, err := client.Write([]byte{1}); err == nil {
		t.Fatal("a connection without half-close stayed open after CloseWrite")
	}
}
