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
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"errors"
	"io"
	"math/big"
	"net/netip"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/tunnel-go/protocol"
)

func TestQUICSessionHandshakeStreamAndDatagram(t *testing.T) {
	t.Parallel()
	serverTLS, clientTLS := testTLSConfigs(t)
	admittedClients := make(chan ClientInfo, 1)
	serverConfig := DefaultServerConfig()
	serverConfig.ServerAdmission = func(
		ctx context.Context,
		client ClientInfo,
	) (context.Context, error) {
		admittedClients <- client
		return ctx, nil
	}
	listener, err := Listen(
		t.Context(),
		"127.0.0.1:0",
		serverTLS,
		serverConfig,
	)
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	t.Cleanup(func() {
		if err := listener.Close(); err != nil {
			t.Errorf("close listener: %v", err)
		}
	})

	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	identities := quicTestIdentities{machineID: uuid.New(), edgeID: uuid.New(), backendID: uuid.New()}
	serverErrors := make(chan error, 1)
	go func() { serverErrors <- serveQUICTestSession(ctx, listener, identities) }()

	session, err := Dial(
		ctx,
		listener.Addr().String(),
		clientTLS,
		DefaultClientConfig(),
	)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	admitted := <-admittedClients
	if !admitted.AddressVerified || admitted.RemoteAddr == nil {
		t.Fatalf("admitted client was not source-address validated: %+v", admitted)
	}
	t.Cleanup(func() {
		if err := session.Close(0, "test complete"); err != nil {
			t.Errorf("close client session: %v", err)
		}
	})
	_, response, err := session.ClientHandshake(ctx, protocol.ClientHello{
		Version:                  protocol.Version,
		MachineID:                identities.machineID,
		SessionID:                uuid.New(),
		MachineSessionGeneration: 1,
		Binding:                  testBinding(),
	})
	if err != nil {
		t.Fatalf("client handshake: %v", err)
	}
	if response.EdgeID != identities.edgeID.String() {
		t.Fatalf("edge ID = %s, want %s", response.EdgeID, identities.edgeID)
	}
	stream := acceptQUICTestPing(ctx, t, session, identities.backendID)
	receiveQUICTestDatagrams(ctx, t, session, identities.backendID)
	if _, err := stream.Write([]byte("done")); err != nil {
		t.Fatalf("acknowledge datagram: %v", err)
	}
	if err := <-serverErrors; err != nil {
		t.Fatalf("server: %v", err)
	}
}

type quicTestIdentities struct {
	machineID uuid.UUID
	edgeID    uuid.UUID
	backendID uuid.UUID
}

func largeQUICTestDatagram() []byte {
	return bytes.Repeat([]byte{0x5a}, protocol.MaxUDPMessageBytes)
}

func serveQUICTestSession(ctx context.Context, listener *Listener, identities quicTestIdentities) (resultErr error) {
	session, err := listener.Accept(ctx)
	if err != nil {
		return err
	}
	defer func() {
		resultErr = errors.Join(resultErr, session.Close(0, "test complete"))
	}()
	_, hello, err := session.ServerHandshake(
		ctx,
		func(value protocol.ClientHello) (protocol.ServerHello, error) {
			return protocol.ServerHello{
				Version: protocol.Version,
				EdgeID:  identities.edgeID.String(),
			}, value.Validate()
		},
	)
	if err != nil {
		return err
	}
	if hello.MachineID != identities.machineID {
		return io.ErrUnexpectedEOF
	}
	stream, err := session.OpenStream(ctx, protocol.StreamOpen{
		Version:              protocol.Version,
		Binding:              testBinding(),
		BackendID:            identities.backendID,
		AssignmentGeneration: 1,
		ConnectionID:         uuid.New(),
		Protocol:             protocol.ProtocolTCP,
		Source:               netip.MustParseAddrPort("203.0.113.1:5000"),
	})
	if err != nil {
		return err
	}
	if _, err := stream.Write([]byte("ping")); err != nil {
		return err
	}
	if err := session.SendUDP(protocol.DatagramToMachine, identities.backendID, 1, 7, []byte("packet")); err != nil {
		return err
	}
	if err := session.SendUDP(protocol.DatagramToMachine, identities.backendID, 1, 8, largeQUICTestDatagram()); err != nil {
		return err
	}
	payload := make([]byte, 4)
	if _, err := io.ReadFull(stream, payload); err != nil {
		return err
	}
	if string(payload) != "done" {
		return io.ErrUnexpectedEOF
	}
	return nil
}

func acceptQUICTestPing(ctx context.Context, t *testing.T, session *Session, backendID uuid.UUID) Stream {
	t.Helper()
	stream, open, err := session.AcceptStream(ctx)
	if err != nil {
		t.Fatalf("accept stream: %v", err)
	}
	if open.BackendID != backendID {
		t.Fatalf("backend ID = %s, want %s", open.BackendID, backendID)
	}
	if err := protocol.WriteFrame(stream, protocol.StreamOpenResult{
		Version: protocol.Version,
		Status:  protocol.StreamOpenStatusAccepted,
	}); err != nil {
		t.Fatalf("accept stream: %v", err)
	}
	payload := make([]byte, 4)
	if _, err := io.ReadFull(stream, payload); err != nil {
		t.Fatalf("read stream: %v", err)
	}
	if string(payload) != "ping" {
		t.Fatalf("stream payload = %q, want ping", payload)
	}
	return stream
}

func receiveQUICTestDatagrams(ctx context.Context, t *testing.T, session *Session, backendID uuid.UUID) {
	t.Helper()
	reassembler, err := protocol.NewReassembler(protocol.DefaultReassemblerConfig())
	if err != nil {
		t.Fatalf("create reassembler: %v", err)
	}
	var receivedSmall, receivedLarge bool
	for !receivedSmall || !receivedLarge {
		datagram, err := session.ReceiveUDP(ctx)
		if err != nil {
			t.Fatalf("receive datagram: %v", err)
		}
		if datagram.BackendID != backendID {
			t.Fatalf("unexpected backend ID: %s", datagram.BackendID)
		}
		payload, complete, err := reassembler.Add(datagram, time.Now())
		if err != nil {
			t.Fatalf("reassemble datagram: %v", err)
		}
		if !complete {
			continue
		}
		switch datagram.FlowID {
		case 7:
			receivedSmall = string(payload) == "packet"
		case 8:
			receivedLarge = bytes.Equal(payload, largeQUICTestDatagram())
		default:
			t.Fatalf("unexpected flow ID: %d", datagram.FlowID)
		}
	}
}

func testBinding() protocol.Binding {
	return protocol.Binding{
		ID: uuid.New(), Revision: 1, Digest: strings.Repeat("a", 64),
	}
}

func testTLSConfigs(t testing.TB) (*tls.Config, *tls.Config) {
	t.Helper()
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	template := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "localhost"},
		DNSNames:     []string{"localhost"},
		NotBefore:    time.Now().Add(-time.Minute),
		NotAfter:     time.Now().Add(time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}
	der, err := x509.CreateCertificate(
		rand.Reader,
		template,
		template,
		publicKey,
		privateKey,
	)
	if err != nil {
		t.Fatalf("create certificate: %v", err)
	}
	certificate := tls.Certificate{
		Certificate: [][]byte{der},
		PrivateKey:  privateKey,
	}
	roots := x509.NewCertPool()
	parsed, err := x509.ParseCertificate(der)
	if err != nil {
		t.Fatalf("parse certificate: %v", err)
	}
	roots.AddCert(parsed)
	return &tls.Config{
		Certificates: []tls.Certificate{certificate},
	}, &tls.Config{
		RootCAs:    roots,
		ServerName: "localhost",
	}
}
