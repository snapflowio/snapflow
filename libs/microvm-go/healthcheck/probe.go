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

package healthcheck

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strconv"
)

type ExecProber interface {
	Probe(ctx context.Context, check ExecCheck) error
}

// GuestDialer opens a connection to a guest port from inside the guest's
// network namespace; nil means the instance has no network.
type GuestDialer func(ctx context.Context, network string, port int) (net.Conn, error)

type Prober struct {
	Dial       GuestDialer
	ExecProber ExecProber
}

const probeHost = "guest"

func (prober Prober) Check(ctx context.Context, policy *Policy) ProbeResult {
	switch policy.Type {
	case TypeHTTP:
		return prober.checkHTTP(ctx, *policy.HTTP)
	case TypeTCP:
		return prober.checkTCP(ctx, *policy.TCP)
	case TypeExec:
		return prober.checkExec(ctx, *policy.Exec)
	default:
		return ProbeResult{Error: "health check is disabled"}
	}
}

func (prober Prober) checkHTTP(ctx context.Context, check HTTPCheck) ProbeResult {
	if prober.Dial == nil {
		return ProbeResult{Error: "instance has no network address"}
	}
	target := url.URL{Scheme: check.Scheme, Host: net.JoinHostPort(probeHost, strconv.Itoa(int(check.Port))), Path: check.Path}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, target.String(), nil)
	if err != nil {
		return ProbeResult{Error: err.Error()}
	}
	client := &http.Client{Transport: &http.Transport{
		DisableKeepAlives: true,
		DialContext: func(ctx context.Context, network, _ string) (net.Conn, error) {
			return prober.Dial(ctx, network, int(check.Port))
		},
	}}
	response, err := client.Do(request)
	if err != nil {
		return ProbeResult{Error: err.Error()}
	}
	defer response.Body.Close()
	if response.StatusCode != check.ExpectedStatus {
		return ProbeResult{Error: fmt.Sprintf("expected HTTP status %d, got %d", check.ExpectedStatus, response.StatusCode)}
	}
	return ProbeResult{Success: true}
}

func (prober Prober) checkTCP(ctx context.Context, check TCPCheck) ProbeResult {
	if prober.Dial == nil {
		return ProbeResult{Error: "instance has no network address"}
	}
	connection, err := prober.Dial(ctx, "tcp", int(check.Port))
	if err != nil {
		return ProbeResult{Error: err.Error()}
	}
	if err := connection.Close(); err != nil {
		return ProbeResult{Error: fmt.Sprintf("close health check connection: %v", err)}
	}
	return ProbeResult{Success: true}
}

func (prober Prober) checkExec(ctx context.Context, check ExecCheck) ProbeResult {
	if prober.ExecProber == nil {
		return ProbeResult{Error: "exec health checks are unavailable"}
	}
	if err := prober.ExecProber.Probe(ctx, check); err != nil {
		return ProbeResult{Error: err.Error()}
	}
	return ProbeResult{Success: true}
}
