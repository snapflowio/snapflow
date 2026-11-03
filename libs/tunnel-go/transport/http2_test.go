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
	"context"
	"crypto/tls"
	"net"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/tunnel-go/protocol"
)

const (
	testHTTP2Timeout       = 5 * time.Second
	testShortFrameDeadline = 200 * time.Millisecond
	testCloseCode          = 0
	testCloseReason        = "test complete"
	testFlowID             = 42
	testGeneration         = 1
)

func TestHTTP2HandshakeAndDatagrams(t *testing.T) {
	t.Parallel()
	ctx, cancel := context.WithTimeout(context.Background(), testHTTP2Timeout)
	defer cancel()
	client, server := newTestHTTP2Pair(ctx, t, DefaultClientConfig(), DefaultServerConfig())
	edgeID := uuid.New()
	backendID := uuid.New()
	serverResult := make(chan error, 1)
	go func() {
		_, _, handshakeErr := server.ServerHandshake(
			ctx,
			func(hello protocol.ClientHello) (protocol.ServerHello, error) {
				return protocol.ServerHello{
					Version: protocol.Version,
					EdgeID:  edgeID.String(),
				}, hello.Validate()
			},
		)
		if handshakeErr != nil {
			serverResult <- handshakeErr
			return
		}
		datagram, receiveErr := server.ReceiveUDP(ctx)
		if receiveErr == nil && (datagram.BackendID != backendID || datagram.FlowID != testFlowID) {
			t.Errorf("received unexpected HTTP/2 datagram: %+v", datagram)
		}
		serverResult <- receiveErr
	}()
	_, hello, err := client.ClientHandshake(ctx, testClientHello())
	if err != nil {
		t.Fatalf("HTTP/2 handshake: %v", err)
	}
	if hello.EdgeID != edgeID.String() {
		t.Fatalf("edge ID = %s, want %s", hello.EdgeID, edgeID)
	}
	if err := client.SendUDP(protocol.DatagramToEdge, backendID, testGeneration, testFlowID, []byte("http2")); err != nil {
		t.Fatalf("send HTTP/2 datagram: %v", err)
	}
	if err := <-serverResult; err != nil {
		t.Fatalf("HTTP/2 server: %v", err)
	}
	if client.TransportName() != TransportNameHTTP2 {
		t.Fatalf("transport = %s, want %s", client.TransportName(), TransportNameHTTP2)
	}
}

func TestHTTP2SessionOutlivesDialContext(t *testing.T) {
	t.Parallel()
	serverTLS, clientTLS := testTLSConfigs(t)
	listener := listenTestHTTP2(t.Context(), t, serverTLS, DefaultServerConfig())
	secured, err := clientTLSConfig(clientTLS)
	if err != nil {
		t.Fatalf("build client TLS config: %v", err)
	}
	dialContext, cancelDial := context.WithTimeout(context.Background(), testHTTP2Timeout)
	carrier, err := dialHTTP2(dialContext, listener.listener.Addr().String(), secured, DefaultClientConfig())
	cancelDial()
	if err != nil {
		t.Fatalf("dial HTTP/2: %v", err)
	}
	client := newHTTP2Session(carrier, DefaultClientConfig())
	t.Cleanup(func() {
		if err := client.Close(testCloseCode, testCloseReason); err != nil {
			t.Errorf("close HTTP/2 client: %v", err)
		}
	})
	select {
	case <-client.Context().Done():
		t.Fatal("cancelling the dial context ended the HTTP/2 session")
	case <-time.After(testShortFrameDeadline):
	}
}

func TestServerHandshakeTimesOutSilentClient(t *testing.T) {
	t.Parallel()
	ctx, cancel := context.WithTimeout(context.Background(), testHTTP2Timeout)
	defer cancel()
	serverConfig := DefaultServerConfig()
	serverConfig.ControlHandshakeTimeout = testShortFrameDeadline
	client, server := newTestHTTP2Pair(ctx, t, DefaultClientConfig(), serverConfig)
	silent, err := client.carrier.openStream(ctx)
	if err != nil {
		t.Fatalf("open silent control stream: %v", err)
	}
	defer closeTestStream(t, silent)
	started := time.Now()
	_, _, err = server.ServerHandshake(ctx, func(protocol.ClientHello) (protocol.ServerHello, error) {
		return protocol.ServerHello{}, nil
	})
	if err == nil {
		t.Fatal("server handshake succeeded without a client hello")
	}
	if elapsed := time.Since(started); elapsed >= testHTTP2Timeout/2 {
		t.Fatalf("server handshake waited %s for a silent client", elapsed)
	}
}

func TestAcceptStreamTimesOutSilentOpener(t *testing.T) {
	t.Parallel()
	ctx, cancel := context.WithTimeout(context.Background(), testHTTP2Timeout)
	defer cancel()
	clientConfig := DefaultClientConfig()
	clientConfig.OpenStreamTimeout = testShortFrameDeadline
	client, server := newTestHTTP2Pair(ctx, t, clientConfig, DefaultServerConfig())
	silent, err := server.carrier.openStream(ctx)
	if err != nil {
		t.Fatalf("open silent stream: %v", err)
	}
	defer closeTestStream(t, silent)
	started := time.Now()
	if _, _, err := client.AcceptStream(ctx); err == nil {
		t.Fatal("accepted a stream without a stream-open frame")
	}
	if elapsed := time.Since(started); elapsed >= testHTTP2Timeout/2 {
		t.Fatalf("accept waited %s for a silent opener", elapsed)
	}
}

func TestDialUsesHTTP2WhenQUICIsUnavailable(t *testing.T) {
	t.Parallel()
	serverTLS, clientTLS := testTLSConfigs(t)
	securedServerTLS, err := ServerTLSConfig(serverTLS)
	if err != nil {
		t.Fatalf("secure server TLS: %v", err)
	}
	listener := listenTestHTTP2(t.Context(), t, securedServerTLS, DefaultServerConfig())
	clientConfig := DefaultClientConfig()
	clientConfig.HandshakeTimeout = 100 * time.Millisecond
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	session, err := Dial(ctx, listener.listener.Addr().String(), clientTLS, clientConfig)
	if err != nil {
		t.Fatalf("automatic HTTP/2 dial: %v", err)
	}
	if session.TransportName() != TransportNameHTTP2 {
		t.Fatalf("transport = %q, want %s", session.TransportName(), TransportNameHTTP2)
	}
	if err := session.Close(testCloseCode, testCloseReason); err != nil {
		t.Fatalf("close HTTP/2 session: %v", err)
	}
}

func TestTunnelHelloCannotReplayAcrossTLSCarrierSessions(t *testing.T) {
	t.Parallel()
	ctx, cancel := context.WithTimeout(context.Background(), testHTTP2Timeout)
	defer cancel()
	firstClient, firstServer := newTestHTTP2Pair(ctx, t, DefaultClientConfig(), DefaultServerConfig())
	hello := testClientHello()
	binding, err := firstClient.tlsExporterBinding(hello)
	if err != nil {
		t.Fatalf("bind first carrier: %v", err)
	}
	hello.TLSExporterBinding = binding
	if err := firstServer.verifyTLSExporterBinding(hello); err != nil {
		t.Fatalf("verify original carrier binding: %v", err)
	}
	_, secondServer := newTestHTTP2Pair(ctx, t, DefaultClientConfig(), DefaultServerConfig())
	if err := secondServer.verifyTLSExporterBinding(hello); err == nil {
		t.Fatal("tunnel hello replayed across independent TLS carrier sessions")
	}
}

func testClientHello() protocol.ClientHello {
	return protocol.ClientHello{
		Version:                  protocol.Version,
		MachineID:                uuid.New(),
		SessionID:                uuid.New(),
		MachineSessionGeneration: testGeneration,
		Binding:                  testBinding(),
	}
}

func closeTestStream(t *testing.T, stream Stream) {
	t.Helper()
	if err := stream.Close(); err != nil {
		t.Errorf("close test stream: %v", err)
	}
}

func newTestHTTP2Pair(
	ctx context.Context,
	t *testing.T,
	clientConfig Config,
	serverConfig Config,
) (*Session, *Session) {
	t.Helper()
	serverTLS, clientTLS := testTLSConfigs(t)
	listener := listenTestHTTP2(ctx, t, serverTLS, serverConfig)
	secured, err := clientTLSConfig(clientTLS)
	if err != nil {
		t.Fatalf("build client TLS config: %v", err)
	}
	clientCarrier, err := dialHTTP2(ctx, listener.listener.Addr().String(), secured, clientConfig)
	if err != nil {
		t.Fatalf("dial HTTP/2: %v", err)
	}
	client := newHTTP2Session(clientCarrier, clientConfig)
	t.Cleanup(func() {
		if err := client.Close(testCloseCode, testCloseReason); err != nil {
			t.Errorf("close HTTP/2 client: %v", err)
		}
	})
	var serverCarrier *http2Carrier
	select {
	case serverCarrier = <-listener.sessions:
	case <-ctx.Done():
		t.Fatalf("accept HTTP/2: %v", ctx.Err())
	}
	server := newHTTP2Session(serverCarrier, serverConfig)
	t.Cleanup(func() {
		if err := server.Close(testCloseCode, testCloseReason); err != nil {
			t.Errorf("close HTTP/2 server: %v", err)
		}
	})
	return client, server
}

func listenTestHTTP2(ctx context.Context, t *testing.T, tlsConfig *tls.Config, config Config) *http2Listener {
	t.Helper()
	var listenerConfig net.ListenConfig
	tcpListener, err := listenerConfig.Listen(ctx, "tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen TCP: %v", err)
	}
	listener, err := serveHTTP2(tcpListener, tlsConfig, config)
	if err != nil {
		t.Fatalf("serve HTTP/2: %v", err)
	}
	t.Cleanup(func() {
		if err := listener.close(); err != nil {
			t.Errorf("close HTTP/2 listener: %v", err)
		}
	})
	return listener
}
