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

package socketdial

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"time"
)

const (
	unixNetwork           = "unix"
	expectContinueTimeout = time.Second
)

type DialFunc = func(ctx context.Context, network, address string) (net.Conn, error)

func Endpoint(endpoint string, dial func(context.Context) (net.Conn, error)) DialFunc {
	return func(ctx context.Context, network, address string) (net.Conn, error) {
		connection, err := dial(ctx)
		if err != nil {
			return nil, fmt.Errorf("dial %s %s through %s: %w", network, address, endpoint, err)
		}
		return connection, nil
	}
}

func Unix(socketPath string) DialFunc {
	return unixEndpoint(socketPath, net.Dialer{})
}

func UnixWithTimeout(socketPath string, timeout time.Duration) DialFunc {
	return unixEndpoint(socketPath, net.Dialer{Timeout: timeout})
}

func unixEndpoint(socketPath string, dialer net.Dialer) DialFunc {
	return Endpoint("unix socket "+socketPath, func(ctx context.Context) (net.Conn, error) {
		return dialer.DialContext(ctx, unixNetwork, socketPath)
	})
}

func HTTPTransport(dial DialFunc) *http.Transport {
	return &http.Transport{
		DialContext:           dial,
		DisableKeepAlives:     true,
		ExpectContinueTimeout: expectContinueTimeout,
	}
}
