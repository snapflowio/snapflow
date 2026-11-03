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
	"sync/atomic"
	"testing"
	"time"
)

func TestDialerDoesNotSerializeIndependentSessionDials(t *testing.T) {
	t.Parallel()
	firstStarted := make(chan struct{})
	releaseFirst := make(chan struct{})
	var calls atomic.Int32
	dialer := NewDialer()
	dialer.dial = func(
		context.Context,
		string,
		*tls.Config,
		Config,
	) (*Session, error) {
		if calls.Add(1) == 1 {
			close(firstStarted)
			<-releaseFirst
		}
		return newQUICSession(nil, DefaultClientConfig()), nil
	}
	firstDone := make(chan error, 1)
	go func() {
		_, err := dialer.Dial(
			context.Background(),
			"edge.example:443",
			&tls.Config{},
			DefaultClientConfig(),
		)
		firstDone <- err
	}()
	<-firstStarted

	secondDone := make(chan error, 1)
	go func() {
		_, err := dialer.Dial(
			context.Background(),
			"edge.example:443",
			&tls.Config{},
			DefaultClientConfig(),
		)
		secondDone <- err
	}()
	select {
	case err := <-secondDone:
		if err != nil {
			t.Fatalf("second dial failed: %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("second session dial was serialized behind the first")
	}
	close(releaseFirst)
	if err := <-firstDone; err != nil {
		t.Fatalf("first dial failed: %v", err)
	}
}

const http2EdgeAddress = "edge.example:443"

func TestDialerRemembersHTTP2WithoutHoldingNetworkLock(t *testing.T) {
	t.Parallel()
	modes := make(chan DialMode, 2)
	dialer := NewDialer()
	dialer.dial = func(
		ctx context.Context,
		address string,
		tlsConfig *tls.Config,
		config Config,
	) (*Session, error) {
		if address != http2EdgeAddress || tlsConfig == nil {
			t.Errorf("dialed %q with TLS configuration %v", address, tlsConfig)
		}
		modes <- config.DialMode
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		return newHTTP2Session(&http2Carrier{}, DefaultClientConfig()), nil
	}
	config := DefaultClientConfig()
	if _, err := dialer.Dial(
		context.Background(),
		http2EdgeAddress,
		&tls.Config{},
		config,
	); err != nil {
		t.Fatalf("initial dial: %v", err)
	}
	if _, err := dialer.Dial(
		context.Background(),
		http2EdgeAddress,
		&tls.Config{},
		config,
	); err != nil {
		t.Fatalf("HTTP/2 dial: %v", err)
	}
	if first, second := <-modes, <-modes; first != DialModeAuto ||
		second != DialModeHTTP2Only {
		t.Fatalf("dial modes = %q, %q", first, second)
	}
}
