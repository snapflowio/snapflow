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
	"sync"
	"time"
)

const quicProbeInterval = 10 * time.Minute

type Dialer struct {
	mu            sync.Mutex
	http2Until    time.Time
	probeInterval time.Duration
	dial          sessionDialer
}

func NewDialer() *Dialer {
	return &Dialer{
		probeInterval: quicProbeInterval,
		dial:          Dial,
	}
}

type sessionDialer func(
	context.Context,
	string,
	*tls.Config,
	Config,
) (*Session, error)

func (dialer *Dialer) Dial(
	ctx context.Context,
	address string,
	tlsConfig *tls.Config,
	config Config,
) (*Session, error) {
	if config.DialMode != DialModeAuto {
		return dialer.dial(ctx, address, tlsConfig, config)
	}
	if dialer.preferHTTP2(time.Now()) {
		http2Config := config
		http2Config.DialMode = DialModeHTTP2Only
		session, err := dialer.dial(ctx, address, tlsConfig, http2Config)
		if err == nil {
			dialer.remember(session)
			return session, nil
		}
	}
	session, err := dialer.dial(ctx, address, tlsConfig, config)
	if err != nil {
		dialer.forget()
		return nil, err
	}
	dialer.remember(session)
	return session, nil
}

func (dialer *Dialer) preferHTTP2(now time.Time) bool {
	dialer.mu.Lock()
	defer dialer.mu.Unlock()
	return now.Before(dialer.http2Until)
}

func (dialer *Dialer) remember(session *Session) {
	if session.TransportName() != TransportNameHTTP2 {
		dialer.forget()
		return
	}
	dialer.mu.Lock()
	defer dialer.mu.Unlock()
	dialer.http2Until = time.Now().Add(dialer.probeInterval)
}

func (dialer *Dialer) forget() {
	dialer.mu.Lock()
	defer dialer.mu.Unlock()
	dialer.http2Until = time.Time{}
}
