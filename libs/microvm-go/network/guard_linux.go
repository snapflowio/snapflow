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
	"net/netip"
	"os"
	"slices"
	"strings"
	"time"

	"github.com/snapflowio/microvm-go/types"

	"github.com/snapflowio/microvm-go/internal/netrules"
	"github.com/vishvananda/netns"
)

const (
	poolRefreshInterval = time.Hour
	poolResolveTimeout  = 30 * time.Second
	httpPort            = 80
	httpsPort           = 443
)

func (m *Manager) SetTrafficPolicy(ctx context.Context, policy TrafficPolicy) error {
	if err := policy.Validate(); err != nil {
		return err
	}
	m.mu.Lock()
	if m.traffic == policy {
		m.mu.Unlock()
		return nil
	}
	m.traffic = policy
	bindings := make([]PolicyBinding, 0, len(m.bindings))
	for _, binding := range m.bindings {
		bindings = append(bindings, binding)
	}
	m.mu.Unlock()
	if !m.config.Enabled {
		return nil
	}
	failures := []error{m.applyHost()}
	for _, binding := range bindings {
		if err := m.applyBinding(ctx, binding); err != nil {
			failures = append(failures, fmt.Errorf("instance %s: %w", binding.InstanceID, err))
		}
	}
	return errors.Join(failures...)
}

func (m *Manager) ensureResolver(ctx context.Context) error {
	m.mu.Lock()
	running := m.resolver != nil
	m.mu.Unlock()
	if running {
		return nil
	}
	resolver, err := newResolverGuard(m.config.DNS, m.identify)
	if err != nil {
		return err
	}
	if err := resolver.start(ctx); err != nil {
		return err
	}
	m.mu.Lock()
	m.resolver = resolver
	m.mu.Unlock()
	return m.applyHost()
}

func (m *Manager) resolverPort() uint16 {
	if m.resolver == nil {
		return 0
	}
	return ResolverGuardPort
}

func (m *Manager) identify(source netip.Addr) (string, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for id, binding := range m.bindings {
		if transit, err := netip.ParseAddr(binding.TransitSandbox); err == nil && transit == source {
			return id, true
		}
	}
	return "", false
}

func (m *Manager) refreshPool(ctx context.Context) bool {
	m.mu.Lock()
	resolver := m.resolver
	due := resolver != nil && time.Since(m.poolCheckedAt) >= poolRefreshInterval
	m.mu.Unlock()
	if !due {
		return false
	}
	resolveContext, cancel := context.WithTimeout(ctx, poolResolveTimeout)
	defer cancel()
	addresses := resolver.resolvePools(resolveContext)
	m.mu.Lock()
	defer m.mu.Unlock()
	m.poolCheckedAt = time.Now()
	if len(addresses) == 0 || slices.Equal(addresses, m.pool) {
		return false
	}
	m.pool = addresses
	return true
}

func (m *Manager) ensureInspector(ctx context.Context, id, namespace string) error {
	m.mu.Lock()
	_, running := m.inspectors[id]
	m.mu.Unlock()
	if running {
		return nil
	}
	inspector, err := startStratumInspector(ctx, namespace)
	if err != nil {
		return err
	}
	m.mu.Lock()
	m.inspectors[id] = inspector
	m.mu.Unlock()
	return nil
}

func (m *Manager) stopInspector(id string) error {
	m.mu.Lock()
	inspector, running := m.inspectors[id]
	delete(m.inspectors, id)
	m.mu.Unlock()
	if !running {
		return nil
	}
	return inspector.stop()
}

func (m *Manager) stratumQueue(id string) *uint16 {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, running := m.inspectors[id]; !running {
		return nil
	}
	queue := stratumQueue
	return &queue
}

func (m *Manager) guardNamespace(allocation *Allocation) (netns.NsHandle, bool, error) {
	if !m.config.Enabled || allocation == nil || allocation.Namespace == "" {
		return netns.None(), false, nil
	}
	ns, err := netns.GetFromName(allocation.Namespace)
	if errors.Is(err, os.ErrNotExist) {
		return netns.None(), false, nil
	}
	if err != nil {
		return netns.None(), false, fmt.Errorf("open network namespace %s: %w", allocation.Namespace, err)
	}
	return ns, true, nil
}

func (m *Manager) ReadConnections(_ context.Context, allocation *Allocation) ([]types.ConnectionRecord, error) {
	ns, found, err := m.guardNamespace(allocation)
	if err != nil || !found {
		return nil, err
	}
	defer ns.Close()
	return netrules.ReadConnectionRecords(int(ns))
}

func (m *Manager) ReadGuard(_ context.Context, allocation *Allocation) (types.GuardReading, error) {
	ns, found, err := m.guardNamespace(allocation)
	if err != nil || !found {
		return types.GuardReading{}, err
	}
	defer ns.Close()
	counters, err := netrules.ReadSandboxCounters(int(ns))
	if err != nil {
		return types.GuardReading{}, err
	}
	endpoints, err := netrules.ReadEndpoints(int(ns), netrules.SetRecentEndpoints)
	if err != nil {
		return types.GuardReading{}, err
	}
	miningFlows, err := netrules.ReadEndpoints(int(ns), netrules.SetMiningFlows)
	if err != nil {
		return types.GuardReading{}, err
	}
	connections, err := netrules.ReadConnectionRecords(int(ns))
	if err != nil {
		return types.GuardReading{}, err
	}
	id := strings.TrimPrefix(allocation.Namespace, namespacePrefix)
	summary := summarizeEndpoints(endpoints)
	summary.MiningPortFlows = len(miningFlows)
	reading := types.GuardReading{
		Counters: guardCounters(counters), Endpoints: summary, Connections: connections, Available: true,
	}
	m.mu.Lock()
	if inspector, ok := m.inspectors[id]; ok {
		reading.StratumHits = inspector.hits.Load()
	}
	resolver := m.resolver
	m.mu.Unlock()
	if resolver != nil {
		reading.Resolver = resolver.reading(id)
	}
	return reading, nil
}

func guardCounters(counters map[string]netrules.CounterReading) types.GuardCounters {
	packets := func(name string) uint64 { return counters[name].Packets }
	return types.GuardCounters{
		PacketsLimited:       packets(netrules.CounterPacketsLimited),
		NewConnectionLimited: packets(netrules.CounterNewConnectionLimited),
		DestinationLimited:   packets(netrules.CounterDestinationLimited),
		ConnectionCapped:     packets(netrules.CounterConnectionCapped),
		UDPLimited:           packets(netrules.CounterUDPLimited),
		ICMPLimited:          packets(netrules.CounterICMPLimited),
		SMTPBlocked:          packets(netrules.CounterSMTPBlocked),
		DoTBlocked:           packets(netrules.CounterDoTBlocked),
		PoolBlocked:          packets(netrules.CounterPoolBlocked),
		ReflectionBlocked:    packets(netrules.CounterReflectionBlocked),
		BruteForce:           packets(netrules.CounterBruteForce),
		TCPAttempts:          packets(netrules.CounterTCPAttempts),
		TCPRefused:           packets(netrules.CounterTCPRefused),
	}
}

func summarizeEndpoints(endpoints []netrules.Endpoint) types.EndpointSummary {
	ports := make(map[netip.Addr]int)
	nonWeb := make(map[netip.Addr]struct{})
	for _, endpoint := range endpoints {
		ports[endpoint.Address]++
		if endpoint.Port != httpPort && endpoint.Port != httpsPort {
			nonWeb[endpoint.Address] = struct{}{}
		}
	}
	summary := types.EndpointSummary{
		Endpoints:          len(endpoints),
		Destinations:       len(ports),
		NonWebDestinations: len(nonWeb),
		Saturated:          len(endpoints) >= netrules.RecentEndpointsCapacity,
	}
	for _, count := range ports {
		summary.MaxPortsPerDestination = max(summary.MaxPortsPerDestination, count)
	}
	return summary
}
