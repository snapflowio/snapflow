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
	"errors"
	"fmt"
	"net"
	"sync"

	"github.com/quic-go/quic-go"
)

const (
	automaticListenPort              = "0"
	maximumEphemeralPortBindAttempts = 16
)

type Listener struct {
	listener   *quic.Listener
	transport  *quic.Transport
	packetConn *net.UDPConn
	http2      *http2Listener
	config     Config
	closeOnce  sync.Once
	closeErr   error
}

func Listen(
	ctx context.Context,
	address string,
	tlsConfig *tls.Config,
	config Config,
) (*Listener, error) {
	if err := config.validate(); err != nil {
		return nil, err
	}
	secured, err := ServerTLSConfig(tlsConfig)
	if err != nil {
		return nil, err
	}
	packetConn, tcpListener, err := listenTransportSockets(ctx, address)
	if err != nil {
		return nil, err
	}
	quicTransport := newQUICTransport(packetConn, config)
	listener, err := quicTransport.Listen(secured, quicConfig(config))
	if err != nil {
		return nil, errors.Join(
			fmt.Errorf("listen for QUIC sessions: %w", err),
			tcpListener.Close(),
			quicTransport.Close(),
			packetConn.Close(),
		)
	}
	http2Sessions, err := serveHTTP2(
		tcpListener,
		secured,
		config,
	)
	if err != nil {
		return nil, errors.Join(
			err,
			listener.Close(),
			quicTransport.Close(),
			packetConn.Close(),
		)
	}
	return &Listener{
		listener:   listener,
		transport:  quicTransport,
		packetConn: packetConn,
		http2:      http2Sessions,
		config:     config,
	}, nil
}

func newQUICTransport(packetConn *net.UDPConn, config Config) *quic.Transport {
	quicTransport := &quic.Transport{Conn: packetConn}
	if config.ServerKeys != nil {
		statelessResetKey := quic.StatelessResetKey(config.ServerKeys.StatelessReset)
		tokenGeneratorKey := quic.TokenGeneratorKey(config.ServerKeys.TokenGenerator)
		quicTransport.StatelessResetKey = &statelessResetKey
		quicTransport.TokenGeneratorKey = &tokenGeneratorKey
	}
	if config.RequireAddressValidation {
		quicTransport.VerifySourceAddress = func(net.Addr) bool {
			return true
		}
	}
	if config.ServerAdmission != nil {
		quicTransport.ConnContext = func(ctx context.Context, info *quic.ClientInfo) (context.Context, error) {
			return config.ServerAdmission(ctx, ClientInfo{
				RemoteAddr:      info.RemoteAddr,
				AddressVerified: info.AddrVerified,
			})
		}
	}
	return quicTransport
}

func listenTransportSockets(
	ctx context.Context,
	address string,
) (*net.UDPConn, net.Listener, error) {
	_, port, err := net.SplitHostPort(address)
	if err != nil {
		return nil, nil, fmt.Errorf("parse tunnel listen address: %w", err)
	}
	attempts := 1
	if port == automaticListenPort {
		attempts = maximumEphemeralPortBindAttempts
	}
	var (
		bindErr        error
		listenerConfig net.ListenConfig
	)
	for range attempts {
		tcpListener, listenErr := listenerConfig.Listen(ctx, "tcp", address)
		if listenErr != nil {
			return nil, nil, fmt.Errorf(
				"listen for HTTP/2 tunnel sessions: %w",
				listenErr,
			)
		}
		udpAddress, resolveErr := net.ResolveUDPAddr(
			"udp",
			tcpListener.Addr().String(),
		)
		if resolveErr != nil {
			return nil, nil, errors.Join(
				fmt.Errorf("resolve QUIC listen address: %w", resolveErr),
				tcpListener.Close(),
			)
		}
		packetConn, listenErr := net.ListenUDP("udp", udpAddress)
		if listenErr == nil {
			return packetConn, tcpListener, nil
		}
		bindErr = errors.Join(
			fmt.Errorf("listen for QUIC packets: %w", listenErr),
			tcpListener.Close(),
		)
		if attempts == 1 {
			break
		}
	}
	return nil, nil, fmt.Errorf(
		"bind tunnel TCP and UDP listeners after %d attempts: %w",
		attempts,
		bindErr,
	)
}

func (listener *Listener) Accept(ctx context.Context) (*Session, error) {
	type quicResult struct {
		connection *quic.Conn
		err        error
	}
	acceptContext, cancel := context.WithCancel(ctx)
	defer cancel()
	quicResults := make(chan quicResult, 1)
	go func() {
		connection, err := listener.listener.Accept(acceptContext)
		quicResults <- quicResult{connection: connection, err: err}
	}()
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case carrier, open := <-listener.http2.sessions:
		if !open {
			return nil, errors.New("HTTP/2 tunnel listener closed")
		}
		return newHTTP2Session(carrier, listener.config), nil
	case err := <-listener.http2.errs:
		if err != nil {
			return nil, fmt.Errorf("accept HTTP/2 tunnel session: %w", err)
		}
		return nil, errors.New("HTTP/2 tunnel listener stopped")
	case result := <-quicResults:
		if result.err != nil {
			return nil, fmt.Errorf("accept QUIC session: %w", result.err)
		}
		return Wrap(result.connection, listener.config)
	}
}

func (listener *Listener) Close() error {
	listener.closeOnce.Do(func() {
		listener.closeErr = errors.Join(
			listener.listener.Close(),
			listener.http2.close(),
			listener.transport.Close(),
			listener.packetConn.Close(),
		)
	})
	return listener.closeErr
}

func (listener *Listener) Addr() net.Addr {
	return listener.listener.Addr()
}
