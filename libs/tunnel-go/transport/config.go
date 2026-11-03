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
	"crypto/hmac"
	"crypto/sha256"
	"errors"
	"fmt"
	"net"
	"time"
)

type ClientInfo struct {
	RemoteAddr      net.Addr
	AddressVerified bool
}

type ServerAdmission func(context.Context, ClientInfo) (context.Context, error)

const (
	defaultMaxDatagramFrameBytes          = 1_100
	minimumDatagramFrameBytes             = 64
	maximumDatagramFrameBytes             = 64 << 10
	defaultHandshakeTimeout               = 5 * time.Second
	defaultMaxIdleTimeout                 = 45 * time.Second
	defaultKeepAlivePeriod                = 10 * time.Second
	defaultInitialStreamReceiveWindow     = 1 << 20
	defaultMaxStreamReceiveWindow         = 16 << 20
	defaultInitialConnectionReceiveWindow = 4 << 20
	defaultMaxConnectionReceiveWindow     = 64 << 20
	defaultMaxHTTP2TLSHandshakes          = 256
	defaultMaxHTTP2TLSHandshakesPerIP     = 8
	serverIncomingStreams                 = 1
	clientIncomingStreams                 = 4_096
	quicServerKeyScope                    = "snapflow-tunnel-quic-server-v1\x00"
	statelessResetKeyPurpose              = "stateless-reset"
	tokenGeneratorKeyPurpose              = "token-generator"
)

type ServerKeys struct {
	StatelessReset [sha256.Size]byte
	TokenGenerator [sha256.Size]byte
}

func DeriveServerKeys(secret []byte) (ServerKeys, error) {
	if len(secret) < sha256.Size {
		return ServerKeys{}, fmt.Errorf(
			"QUIC server secret has %d bytes, expected at least %d",
			len(secret),
			sha256.Size,
		)
	}
	statelessReset, err := deriveServerKey(secret, statelessResetKeyPurpose)
	if err != nil {
		return ServerKeys{}, err
	}
	tokenGenerator, err := deriveServerKey(secret, tokenGeneratorKeyPurpose)
	if err != nil {
		return ServerKeys{}, err
	}
	return ServerKeys{
		StatelessReset: statelessReset,
		TokenGenerator: tokenGenerator,
	}, nil
}

func deriveServerKey(
	secret []byte,
	purpose string,
) ([sha256.Size]byte, error) {
	mac := hmac.New(sha256.New, secret)
	var result [sha256.Size]byte
	if _, err := mac.Write([]byte(quicServerKeyScope)); err != nil {
		return result, fmt.Errorf("hash QUIC server key scope: %w", err)
	}
	if _, err := mac.Write([]byte(purpose)); err != nil {
		return result, fmt.Errorf("hash QUIC server key purpose: %w", err)
	}
	copy(result[:], mac.Sum(nil))
	return result, nil
}

type DialMode string

const (
	DialModeAuto      DialMode = "auto"
	DialModeQUICOnly  DialMode = "quic-only"
	DialModeHTTP2Only DialMode = "http2-only"
)

type Config struct {
	HandshakeTimeout               time.Duration
	ControlHandshakeTimeout        time.Duration
	OpenStreamTimeout              time.Duration
	MaxIdleTimeout                 time.Duration
	KeepAlivePeriod                time.Duration
	InitialStreamReceiveWindow     uint64
	MaxStreamReceiveWindow         uint64
	InitialConnectionReceiveWindow uint64
	MaxConnectionReceiveWindow     uint64
	MaxIncomingStreams             int64
	MaxDatagramBytes               int
	MaxHTTP2TLSHandshakes          int
	MaxHTTP2TLSHandshakesPerIP     int
	RequireAddressValidation       bool
	ServerAdmission                ServerAdmission
	ServerKeys                     *ServerKeys
	DialMode                       DialMode
}

func DefaultServerConfig() Config {
	result := defaultConfig()
	result.MaxIncomingStreams = serverIncomingStreams
	result.RequireAddressValidation = true
	return result
}

func DefaultClientConfig() Config {
	result := defaultConfig()
	result.MaxIncomingStreams = clientIncomingStreams
	return result
}

func defaultConfig() Config {
	return Config{
		HandshakeTimeout:               defaultHandshakeTimeout,
		ControlHandshakeTimeout:        defaultHandshakeTimeout,
		OpenStreamTimeout:              defaultHandshakeTimeout,
		MaxIdleTimeout:                 defaultMaxIdleTimeout,
		KeepAlivePeriod:                defaultKeepAlivePeriod,
		InitialStreamReceiveWindow:     defaultInitialStreamReceiveWindow,
		MaxStreamReceiveWindow:         defaultMaxStreamReceiveWindow,
		InitialConnectionReceiveWindow: defaultInitialConnectionReceiveWindow,
		MaxConnectionReceiveWindow:     defaultMaxConnectionReceiveWindow,
		MaxDatagramBytes:               defaultMaxDatagramFrameBytes,
		MaxHTTP2TLSHandshakes:          defaultMaxHTTP2TLSHandshakes,
		MaxHTTP2TLSHandshakesPerIP:     defaultMaxHTTP2TLSHandshakesPerIP,
		DialMode:                       DialModeAuto,
	}
}

func (config Config) validate() error {
	checks := []struct {
		valid   bool
		message string
	}{
		{config.validSessionLimits(), "invalid QUIC session limits"},
		{config.validWindows(), "invalid QUIC flow-control windows"},
		{
			config.MaxDatagramBytes > minimumDatagramFrameBytes && config.MaxDatagramBytes <= maximumDatagramFrameBytes,
			"invalid maximum datagram size",
		},
		{
			config.MaxHTTP2TLSHandshakesPerIP >= 1 && config.MaxHTTP2TLSHandshakesPerIP <= config.MaxHTTP2TLSHandshakes,
			"invalid HTTP/2 TLS handshake limits",
		},
		{
			config.DialMode == DialModeAuto || config.DialMode == DialModeQUICOnly || config.DialMode == DialModeHTTP2Only,
			"invalid tunnel dial mode",
		},
	}
	for _, check := range checks {
		if !check.valid {
			return errors.New(check.message)
		}
	}
	return nil
}

func (config Config) validSessionLimits() bool {
	return config.HandshakeTimeout > 0 &&
		config.ControlHandshakeTimeout > 0 &&
		config.OpenStreamTimeout > 0 &&
		config.KeepAlivePeriod > 0 &&
		config.KeepAlivePeriod < config.MaxIdleTimeout &&
		config.MaxIncomingStreams >= 1
}

func (config Config) validWindows() bool {
	return config.InitialStreamReceiveWindow > 0 &&
		config.InitialStreamReceiveWindow <= config.MaxStreamReceiveWindow &&
		config.InitialConnectionReceiveWindow > 0 &&
		config.InitialConnectionReceiveWindow <= config.MaxConnectionReceiveWindow
}
