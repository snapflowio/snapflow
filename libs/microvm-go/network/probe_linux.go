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

//go:build linux

package network

import (
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/snapflowio/microvm-go/internal/netrules"
	"github.com/vishvananda/netns"
)

// The probe's instance IDs are fixed so namespaces left by an interrupted
// probe are recognized and removed by the next run.
const (
	probeInstancePrefix       = "5afe0000-0000-4000-8000-"
	firstProbeInstance        = probeInstancePrefix + "00000000000a"
	secondProbeInstance       = probeInstancePrefix + "00000000000b"
	probeGuestNamespacePrefix = "sfprobe-"
	probeInternetTarget       = "1.1.1.1:443"
	probeDialTimeout          = 3 * time.Second
)

// ErrSandboxesRunning is returned when the probe would disturb live sandboxes.
var ErrSandboxesRunning = errors.New("sandbox network namespaces exist; stop Snapflow before probing isolation, " +
	"because the probe rewrites the shared host network table")

// ProbeIsolation builds two sandbox namespaces with stand-in guests and checks
// every boundary a guest must and must not cross: the internet is reachable;
// the host, its transit address, the gateway and other sandboxes are not;
// linked peers are; and a guest that spoofs its address or MAC is cut off.
// The probe owns the host network table while it runs, so it refuses to start
// while any sandbox namespace exists and removes the table when it finishes;
// Snapflow re-applies it on start.
func ProbeIsolation(ctx context.Context, config Config) (outcomes []ProbeOutcome, err error) {
	if err := refuseWhileSandboxesExist(); err != nil {
		return nil, err
	}
	if err := removeProbeLeftovers(); err != nil {
		return nil, err
	}
	config.Enabled = true
	manager := NewManager(config)
	cleanup := cleanupStack{netrules.RemoveHost}
	defer func() { err = errors.Join(err, cleanup.run()) }()

	setup, err := buildProbe(ctx, manager, &cleanup)
	if err != nil {
		return nil, err
	}
	first, second := setup.first, setup.second
	probe := func(boundary, source, target string, reachable bool) {
		outcomes = append(outcomes, probeBoundary(ctx, first, boundary, source, target, reachable))
	}
	peerTarget := joinPort(second.allocation.TransitSandbox, setup.peerPort)

	probe(BoundaryInternet, "", probeInternetTarget, true)
	probe(BoundaryHostLAN, "", joinPort(setup.hostAddress, setup.hostPort), false)
	probe(BoundaryHostTransit, "", joinPort(first.allocation.TransitHost, setup.hostPort), false)
	probe(BoundaryGateway, "", joinPort(GatewayIP, setup.gatewayPort), false)
	probe(BoundaryOtherSandbox, "", peerTarget, false)

	for _, binding := range []PolicyBinding{
		first.binding(second.allocation.TransitSandbox),
		second.binding(first.allocation.TransitSandbox),
	} {
		if err := manager.ApplyEgressPolicy(ctx, binding); err != nil {
			return outcomes, fmt.Errorf("link probe sandboxes as peers: %w", err)
		}
	}
	probe(BoundaryLinkedPeer, "", peerTarget, true)

	if err := spoofAddress(first); err != nil {
		return outcomes, err
	}
	probe(BoundarySpoofedIP, probeSpoofedIP, probeInternetTarget, false)
	if err := spoofMAC(first); err != nil {
		return outcomes, err
	}
	probe(BoundarySpoofedMAC, "", probeInternetTarget, false)
	// A cancelled context makes every dial fail, which would read as blocked.
	return outcomes, ctx.Err()
}

// probeSetup is two wired sandboxes plus a listener on the host, in the first
// sandbox namespace and in the second guest.
type probeSetup struct {
	first, second probeGuest
	hostAddress   string
	hostPort      int
	gatewayPort   int
	peerPort      int
}

func buildProbe(ctx context.Context, manager *Manager, cleanup *cleanupStack) (probeSetup, error) {
	var setup probeSetup
	var err error
	if setup.first, err = newProbeGuest(ctx, manager, cleanup, firstProbeInstance, probeGuestNamespace(firstProbeInstance)); err != nil {
		return setup, err
	}
	if setup.second, err = newProbeGuest(ctx, manager, cleanup, secondProbeInstance, probeGuestNamespace(secondProbeInstance)); err != nil {
		return setup, err
	}
	if setup.hostAddress, err = hostLANAddress(manager.transit); err != nil {
		return setup, err
	}
	if setup.hostPort, err = listenIn(ctx, cleanup, netns.None()); err != nil {
		return setup, err
	}
	if setup.gatewayPort, err = listenIn(ctx, cleanup, setup.first.sandbox); err != nil {
		return setup, err
	}
	setup.peerPort, err = listenIn(ctx, cleanup, setup.second.namespace)
	return setup, err
}

func probeBoundary(ctx context.Context, guest probeGuest, boundary, source, target string, reachable bool) ProbeOutcome {
	outcome := ProbeOutcome{Boundary: boundary, Target: target, Reachable: reachable}
	err := dialFrom(ctx, guest, source, target)
	switch {
	case reachable && err != nil:
		outcome.Err = fmt.Errorf("guest could not reach %s: %w", target, err)
	case !reachable && err == nil:
		outcome.Err = fmt.Errorf("guest reached %s, which its namespace must block", target)
	}
	return outcome
}

// refuseWhileSandboxesExist guards the host network table: a fresh manager
// numbers transit slots from zero and rewrites that table, which would break
// the sandboxes of a running Snapflow.
func refuseWhileSandboxesExist() error {
	entries, err := os.ReadDir(namespaceDirectory)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("list network namespaces: %w", err)
	}
	var running []string
	for _, entry := range entries {
		name := entry.Name()
		if strings.HasPrefix(name, namespacePrefix) && !strings.HasPrefix(name, NamespaceName(probeInstancePrefix)) {
			running = append(running, name)
		}
	}
	if len(running) > 0 {
		return fmt.Errorf("%w: %s", ErrSandboxesRunning, strings.Join(running, ", "))
	}
	return nil
}

// removeProbeLeftovers deletes the exact namespaces an interrupted probe may
// have left; deleting a namespace also removes its veth pair.
func removeProbeLeftovers() error {
	var failures []error
	for _, instanceID := range []string{firstProbeInstance, secondProbeInstance} {
		failures = append(failures, deleteNamespace(NamespaceName(instanceID)), deleteNamespace(probeGuestNamespace(instanceID)))
	}
	return errors.Join(failures...)
}

func probeGuestNamespace(instanceID string) string {
	return probeGuestNamespacePrefix + strings.TrimPrefix(instanceID, probeInstancePrefix)
}

func joinPort(host string, port int) string { return net.JoinHostPort(host, strconv.Itoa(port)) }
