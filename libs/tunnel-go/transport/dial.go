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

	"github.com/quic-go/quic-go"
	"github.com/snapflowio/tunnel-go/protocol"
)

const datagramsRequiredCode quic.ApplicationErrorCode = 1

func Dial(
	ctx context.Context,
	address string,
	tlsConfig *tls.Config,
	config Config,
) (*Session, error) {
	if err := config.validate(); err != nil {
		return nil, err
	}
	secured, err := clientTLSConfig(tlsConfig)
	if err != nil {
		return nil, err
	}
	if config.DialMode == DialModeHTTP2Only {
		return dialHTTP2Session(ctx, address, secured, config)
	}
	connection, err := quic.DialAddr(ctx, address, secured, quicConfig(config))
	if err != nil {
		quicErr := fmt.Errorf("dial edge QUIC session: %w", err)
		if config.DialMode == DialModeQUICOnly {
			return nil, quicErr
		}
		session, http2Err := dialHTTP2Session(ctx, address, secured, config)
		if http2Err != nil {
			return nil, errors.Join(quicErr, http2Err)
		}
		return session, nil
	}
	if !supportsDatagrams(connection) {
		return nil, errors.Join(
			errors.New("edge did not negotiate QUIC datagram support"),
			connection.CloseWithError(datagramsRequiredCode, "QUIC datagrams required"),
		)
	}
	return newQUICSession(connection, config), nil
}

func dialHTTP2Session(
	ctx context.Context,
	address string,
	tlsConfig *tls.Config,
	config Config,
) (*Session, error) {
	carrier, err := dialHTTP2(ctx, address, tlsConfig, config)
	if err != nil {
		return nil, fmt.Errorf("dial edge HTTP/2 session: %w", err)
	}
	return newHTTP2Session(carrier, config), nil
}

func Wrap(connection *quic.Conn, config Config) (*Session, error) {
	if connection == nil {
		return nil, errors.New("QUIC connection is required")
	}
	if err := config.validate(); err != nil {
		return nil, err
	}
	if !supportsDatagrams(connection) {
		return nil, errors.New("peer did not negotiate QUIC datagram support")
	}
	return newQUICSession(connection, config), nil
}

func ServerTLSConfig(source *tls.Config) (*tls.Config, error) {
	if source == nil ||
		(len(source.Certificates) == 0 && source.GetCertificate == nil) {
		return nil, errors.New("server TLS certificate is required")
	}
	config := source.Clone()
	config.MinVersion = tls.VersionTLS13
	config.NextProtos = []string{protocol.ALPN}
	return config, nil
}

func clientTLSConfig(source *tls.Config) (*tls.Config, error) {
	if source == nil {
		return nil, errors.New("client TLS configuration is required")
	}
	config := source.Clone()
	if config.ServerName == "" {
		return nil, errors.New("client TLS server name is required")
	}
	config.MinVersion = tls.VersionTLS13
	config.NextProtos = []string{protocol.ALPN}
	return config, nil
}

func quicConfig(config Config) *quic.Config {
	return &quic.Config{
		HandshakeIdleTimeout:           config.HandshakeTimeout,
		MaxIdleTimeout:                 config.MaxIdleTimeout,
		KeepAlivePeriod:                config.KeepAlivePeriod,
		InitialStreamReceiveWindow:     config.InitialStreamReceiveWindow,
		MaxStreamReceiveWindow:         config.MaxStreamReceiveWindow,
		InitialConnectionReceiveWindow: config.InitialConnectionReceiveWindow,
		MaxConnectionReceiveWindow:     config.MaxConnectionReceiveWindow,
		MaxIncomingStreams:             config.MaxIncomingStreams,
		MaxIncomingUniStreams:          -1,
		EnableDatagrams:                true,
	}
}

func supportsDatagrams(connection *quic.Conn) bool {
	support := connection.ConnectionState().SupportsDatagrams
	return support.Local && support.Remote
}
