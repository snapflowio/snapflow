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
	"crypto/subtle"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"io"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/quic-go/quic-go"
	"github.com/snapflowio/tunnel-go/protocol"
)

const (
	TransportNameQUIC  = "quic"
	TransportNameHTTP2 = "http2"
)

type Stream interface {
	io.ReadWriteCloser
	SetDeadline(time.Time) error
	SetReadDeadline(time.Time) error
	SetWriteDeadline(time.Time) error
}

type Metrics struct {
	MinimumRTT      time.Duration
	LatestRTT       time.Duration
	SmoothedRTT     time.Duration
	RTTDeviation    time.Duration
	BytesSent       uint64
	BytesReceived   uint64
	PacketsSent     uint64
	PacketsReceived uint64
	PacketsLost     uint64
}

type carrier interface {
	openStream(ctx context.Context) (Stream, error)
	acceptStream(ctx context.Context) (Stream, error)
	sendDatagram(frame []byte) error
	receiveDatagram(ctx context.Context) ([]byte, error)
	close(code quic.ApplicationErrorCode, reason string) error
	context() context.Context
	metrics() Metrics
	tlsState() tls.ConnectionState
}

type Session struct {
	carrier       carrier
	transportName string
	config        Config
	datagramID    atomic.Uint32
}

func newQUICSession(connection *quic.Conn, config Config) *Session {
	return &Session{
		carrier:       &quicCarrier{connection: connection},
		transportName: TransportNameQUIC,
		config:        config,
	}
}

func newHTTP2Session(carrier *http2Carrier, config Config) *Session {
	return &Session{carrier: carrier, transportName: TransportNameHTTP2, config: config}
}

type StreamOpenRejectedError struct {
	Status       protocol.StreamOpenStatus
	RetryAfterMS uint32
}

func (err *StreamOpenRejectedError) Error() string {
	return fmt.Sprintf("machine rejected tunnel stream: %s", err.Status)
}

func (session *Session) OpenStream(
	ctx context.Context,
	open protocol.StreamOpen,
) (Stream, error) {
	if err := open.Validate(); err != nil {
		return nil, err
	}
	operationContext, cancel := context.WithTimeout(ctx, session.config.OpenStreamTimeout)
	defer cancel()
	stream, err := session.carrier.openStream(operationContext)
	if err != nil {
		return nil, fmt.Errorf("open tunnel stream: %w", err)
	}
	var result protocol.StreamOpenResult
	err = exchangeFrames(operationContext, stream, session.config.OpenStreamTimeout, func() error {
		if err := protocol.WriteFrame(stream, open); err != nil {
			return err
		}
		if err := protocol.ReadFrame(stream, &result); err != nil {
			return fmt.Errorf("read tunnel stream acceptance: %w", err)
		}
		return result.Validate()
	})
	if err != nil {
		return nil, errors.Join(err, stream.Close())
	}
	if result.Status != protocol.StreamOpenStatusAccepted {
		return nil, errors.Join(
			&StreamOpenRejectedError{Status: result.Status, RetryAfterMS: result.RetryAfterMS},
			stream.Close(),
		)
	}
	return stream, nil
}

func (session *Session) ClientHandshake(
	ctx context.Context,
	hello protocol.ClientHello,
) (Stream, protocol.ServerHello, error) {
	binding, err := session.tlsExporterBinding(hello)
	if err != nil {
		return nil, protocol.ServerHello{}, err
	}
	hello.TLSExporterBinding = binding
	if err := hello.Validate(); err != nil {
		return nil, protocol.ServerHello{}, err
	}
	handshakeContext, cancel := context.WithTimeout(ctx, session.config.ControlHandshakeTimeout)
	defer cancel()
	stream, err := session.carrier.openStream(handshakeContext)
	if err != nil {
		return nil, protocol.ServerHello{}, fmt.Errorf("open control stream: %w", err)
	}
	var response protocol.ServerHello
	err = exchangeFrames(handshakeContext, stream, session.config.ControlHandshakeTimeout, func() error {
		if err := protocol.WriteFrame(stream, hello); err != nil {
			return err
		}
		if err := protocol.ReadFrame(stream, &response); err != nil {
			return err
		}
		return response.Validate()
	})
	if err != nil {
		return nil, protocol.ServerHello{}, errors.Join(err, stream.Close())
	}
	return stream, response, nil
}

func (session *Session) ServerHandshake(
	ctx context.Context,
	authenticate func(protocol.ClientHello) (protocol.ServerHello, error),
) (Stream, protocol.ClientHello, error) {
	if authenticate == nil {
		return nil, protocol.ClientHello{}, errors.New("handshake authenticator is required")
	}
	handshakeContext, cancel := context.WithTimeout(ctx, session.config.ControlHandshakeTimeout)
	defer cancel()
	stream, err := session.carrier.acceptStream(handshakeContext)
	if err != nil {
		return nil, protocol.ClientHello{}, fmt.Errorf("accept control stream: %w", err)
	}
	var hello protocol.ClientHello
	err = exchangeFrames(handshakeContext, stream, session.config.ControlHandshakeTimeout, func() error {
		received, err := session.answerHello(stream, authenticate)
		hello = received
		return err
	})
	if err != nil {
		return nil, protocol.ClientHello{}, errors.Join(err, stream.Close())
	}
	return stream, hello, nil
}

func (session *Session) answerHello(
	stream Stream,
	authenticate func(protocol.ClientHello) (protocol.ServerHello, error),
) (protocol.ClientHello, error) {
	var hello protocol.ClientHello
	if err := protocol.ReadFrame(stream, &hello); err != nil {
		return hello, err
	}
	if err := hello.Validate(); err != nil {
		return hello, err
	}
	if err := session.verifyTLSExporterBinding(hello); err != nil {
		return hello, err
	}
	response, err := authenticate(hello)
	if err != nil {
		return hello, err
	}
	if err := response.Validate(); err != nil {
		return hello, err
	}
	return hello, protocol.WriteFrame(stream, response)
}

func (session *Session) AcceptStream(
	ctx context.Context,
) (Stream, protocol.StreamOpen, error) {
	stream, err := session.carrier.acceptStream(ctx)
	if err != nil {
		return nil, protocol.StreamOpen{}, fmt.Errorf("accept tunnel stream: %w", err)
	}
	var open protocol.StreamOpen
	err = exchangeFrames(ctx, stream, session.config.OpenStreamTimeout, func() error {
		if err := protocol.ReadFrame(stream, &open); err != nil {
			return err
		}
		return open.Validate()
	})
	if err != nil {
		return nil, protocol.StreamOpen{}, errors.Join(err, stream.Close())
	}
	return stream, open, nil
}

func (session *Session) SendUDP(
	direction protocol.DatagramDirection,
	backendID uuid.UUID,
	assignmentGeneration uint32,
	flowID uint64,
	payload []byte,
) error {
	fragments, err := protocol.FragmentDatagram(
		direction,
		backendID,
		assignmentGeneration,
		flowID,
		session.nextDatagramID(),
		payload,
		session.config.MaxDatagramBytes,
	)
	if err != nil {
		return err
	}
	for _, fragment := range fragments {
		frame, err := fragment.MarshalBinary()
		if err != nil {
			return err
		}
		if err := session.carrier.sendDatagram(frame); err != nil {
			return fmt.Errorf("send tunnel datagram: %w", err)
		}
	}
	return nil
}

func (session *Session) ReceiveUDP(
	ctx context.Context,
) (protocol.Datagram, error) {
	frame, err := session.carrier.receiveDatagram(ctx)
	if err != nil {
		return protocol.Datagram{}, fmt.Errorf("receive tunnel datagram: %w", err)
	}
	if len(frame) > session.config.MaxDatagramBytes {
		return protocol.Datagram{}, fmt.Errorf(
			"received tunnel datagram with %d bytes, maximum is %d",
			len(frame),
			session.config.MaxDatagramBytes,
		)
	}
	return protocol.ParseDatagram(frame)
}

func (session *Session) Close(
	code quic.ApplicationErrorCode,
	reason string,
) error {
	return session.carrier.close(code, reason)
}

func (session *Session) Context() context.Context {
	return session.carrier.context()
}

func (session *Session) Metrics() Metrics {
	return session.carrier.metrics()
}

func (session *Session) TransportName() string {
	return session.transportName
}

func (session *Session) TLSConnectionState() tls.ConnectionState {
	return session.carrier.tlsState()
}

func (session *Session) VerifiedPeerCertificate() (*x509.Certificate, error) {
	state := session.TLSConnectionState()
	if len(state.VerifiedChains) == 0 || len(state.VerifiedChains[0]) == 0 {
		return nil, errors.New("tunnel peer did not present a verified certificate")
	}
	return state.VerifiedChains[0][0], nil
}

func (session *Session) nextDatagramID() uint32 {
	datagramID := session.datagramID.Add(1)
	if datagramID == 0 {
		datagramID = session.datagramID.Add(1)
	}
	return datagramID
}

func (session *Session) tlsExporterBinding(hello protocol.ClientHello) (string, error) {
	contextBytes, err := hello.TLSExporterContext()
	if err != nil {
		return "", fmt.Errorf("build tunnel TLS exporter context: %w", err)
	}
	state := session.TLSConnectionState()
	binding, err := state.ExportKeyingMaterial(
		protocol.TLSExporterLabel,
		contextBytes,
		protocol.TLSExporterBindingSize,
	)
	if err != nil {
		return "", fmt.Errorf("derive tunnel TLS exporter binding: %w", err)
	}
	return protocol.EncodeTLSExporterBinding(binding)
}

func (session *Session) verifyTLSExporterBinding(hello protocol.ClientHello) error {
	expected, err := session.tlsExporterBinding(hello)
	if err != nil {
		return err
	}
	if subtle.ConstantTimeCompare([]byte(expected), []byte(hello.TLSExporterBinding)) != 1 {
		return errors.New("tunnel hello TLS exporter binding does not match the carrier")
	}
	return nil
}

func exchangeFrames(
	ctx context.Context,
	stream Stream,
	timeout time.Duration,
	exchange func() error,
) error {
	deadline := time.Now().Add(timeout)
	if contextDeadline, bounded := ctx.Deadline(); bounded && contextDeadline.Before(deadline) {
		deadline = contextDeadline
	}
	if err := stream.SetDeadline(deadline); err != nil {
		return fmt.Errorf("set tunnel frame deadline: %w", err)
	}
	if err := exchange(); err != nil {
		return err
	}
	if err := stream.SetDeadline(time.Time{}); err != nil {
		return fmt.Errorf("clear tunnel frame deadline: %w", err)
	}
	return nil
}
