// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the license at http://www.apache.org/licenses/LICENSE-2.0
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
	"net/netip"
	"time"

	"github.com/snapflowio/microvm-go/internal/netrules"
	"github.com/vishvananda/netns"
)

func (m *Manager) SupportsEgressPolicy() bool {
	return true
}

func (m *Manager) ApplyEgressPolicy(ctx context.Context, binding PolicyBinding) error {
	if !m.config.Enabled {
		return disabledNetworkPolicyError([]PolicyBinding{binding})
	}
	if binding.Namespace == "" {
		return errors.New("instance network namespace is required for egress policy enforcement")
	}
	m.mu.Lock()
	m.bindings[binding.InstanceID] = binding
	m.mu.Unlock()
	return errors.Join(m.applyBinding(ctx, binding), m.applyHost())
}

func (m *Manager) RemoveEgressPolicy(ctx context.Context, instanceID string) error {
	m.mu.Lock()
	delete(m.bindings, instanceID)
	delete(m.domains, instanceID)
	m.mu.Unlock()
	return m.applyHost()
}

func (m *Manager) ReconcileEgressPolicies(ctx context.Context, bindings []PolicyBinding) error {
	if !m.config.Enabled {
		return disabledNetworkPolicyError(bindings)
	}
	m.mu.Lock()
	m.bindings = make(map[string]PolicyBinding, len(bindings))
	for _, binding := range bindings {
		m.bindings[binding.InstanceID] = binding
	}
	m.domains = make(map[string]domainCache)
	m.mu.Unlock()
	var failures []error
	for _, binding := range bindings {
		if err := m.applyBinding(ctx, binding); err != nil {
			failures = append(failures, fmt.Errorf("instance %s: %w", binding.InstanceID, err))
		}
	}
	return errors.Join(append(failures, m.applyHost())...)
}

func disabledNetworkPolicyError(bindings []PolicyBinding) error {
	for _, binding := range bindings {
		if binding.Policy.Constrained() {
			return fmt.Errorf("instance %s: %w while instance networking is disabled", binding.InstanceID, ErrEgressPolicyUnsupported)
		}
	}
	return nil
}

// applyBinding resolves the binding's domains and rewrites its namespace
// rules and bandwidth limit.
func (m *Manager) applyBinding(ctx context.Context, binding PolicyBinding) error {
	resolved, resolveErr := m.resolveDomains(ctx, binding)
	ns, err := netns.GetFromName(binding.Namespace)
	if err != nil {
		return errors.Join(resolveErr, fmt.Errorf("open network namespace %s: %w", binding.Namespace, err))
	}
	defer ns.Close()
	return errors.Join(
		resolveErr,
		m.applySandboxRules(ns, binding, resolved),
		applyEgressBandwidth(ns, binding.Policy.EgressBandwidthBPS),
	)
}

func (m *Manager) applySandboxRules(ns netns.NsHandle, binding PolicyBinding, resolved []netip.Prefix) error {
	sandbox, err := m.sandboxRules(binding, resolved)
	if err != nil {
		return err
	}
	return netrules.ApplySandbox(int(ns), sandbox)
}

func (m *Manager) sandboxRules(binding PolicyBinding, resolved []netip.Prefix) (netrules.Sandbox, error) {
	mac, err := net.ParseMAC(GuestMAC)
	if err != nil {
		return netrules.Sandbox{}, fmt.Errorf("parse guest MAC: %w", err)
	}
	transit, err := netip.ParseAddr(binding.TransitSandbox)
	if err != nil {
		return netrules.Sandbox{}, fmt.Errorf("parse transit address %q: %w", binding.TransitSandbox, err)
	}
	resolver, err := netip.ParseAddr(binding.DNS)
	if err != nil {
		return netrules.Sandbox{}, fmt.Errorf("parse resolver %q: %w", binding.DNS, err)
	}
	peers := make([]netip.Addr, 0, len(binding.PeerTransits))
	for _, peer := range binding.PeerTransits {
		address, err := netip.ParseAddr(peer)
		if err != nil || !m.transit.Contains(address) {
			return netrules.Sandbox{}, fmt.Errorf("linked peer address %q is not a sandbox transit address", peer)
		}
		peers = append(peers, address)
	}
	allowed := make([]netip.Prefix, 0, len(binding.Policy.AllowedCIDRs)+len(resolved))
	for _, cidr := range binding.Policy.AllowedCIDRs {
		prefix, err := netip.ParsePrefix(cidr)
		if err != nil {
			return netrules.Sandbox{}, fmt.Errorf("parse allowed destination %q: %w", cidr, err)
		}
		allowed = append(allowed, prefix)
	}
	denied, err := m.currentDenied()
	if err != nil {
		return netrules.Sandbox{}, err
	}
	hostTransit, err := netip.ParseAddr(binding.TransitHost)
	if err != nil {
		return netrules.Sandbox{}, fmt.Errorf("parse host transit address %q: %w", binding.TransitHost, err)
	}
	return netrules.Sandbox{
		TAP: TAPName, Uplink: namespaceUplink, GuestMAC: mac,
		GuestIP: netip.MustParseAddr(GuestIP), TransitIP: transit, Resolver: resolver,
		Denied: denied, Peers: peers,
		HostServices: m.config.HostServicePorts,
		Gateway:      netip.MustParseAddr(GatewayIP),
		HostTransit:  hostTransit,
		Policy: netrules.Policy{
			BlockAll:   binding.Policy.BlockAll,
			Allowed:    append(allowed, resolved...),
			Restricted: len(binding.Policy.AllowedDomains) > 0,
		},
	}, nil
}

func (m *Manager) currentDenied() ([]netip.Prefix, error) {
	m.mu.Lock()
	denied := m.denied
	m.mu.Unlock()
	if denied != nil {
		return denied, nil
	}
	computed, err := deniedDestinations()
	if err != nil {
		return nil, err
	}
	m.mu.Lock()
	m.denied = computed
	m.mu.Unlock()
	return computed, nil
}

// resolveDomains returns the cached resolution of the binding's allowed
// domains, resolving again once the shortest record TTL has passed.
func (m *Manager) resolveDomains(ctx context.Context, binding PolicyBinding) ([]netip.Prefix, error) {
	if len(binding.Policy.AllowedDomains) == 0 {
		return nil, nil
	}
	m.mu.Lock()
	cached, ok := m.domains[binding.InstanceID]
	m.mu.Unlock()
	if ok && time.Now().Before(cached.nextRefresh) {
		return cached.prefixes, nil
	}
	resolution, err := resolveAllowedDomains(ctx, binding.DNS, binding.Policy.AllowedDomains)
	ttl := max(resolution.ttl, minimumDNSTTL)
	prefixes := cached.prefixes
	if err == nil {
		prefixes = make([]netip.Prefix, 0, len(resolution.cidrs))
		for _, cidr := range resolution.cidrs {
			prefixes = append(prefixes, netip.MustParsePrefix(cidr))
		}
	}
	m.mu.Lock()
	m.domains[binding.InstanceID] = domainCache{prefixes: prefixes, nextRefresh: time.Now().Add(ttl)}
	m.mu.Unlock()
	return prefixes, err
}

// refreshDomains re-applies an instance's rules when its domain resolution
// has expired; metering calls it so allow lists track DNS changes.
func (m *Manager) refreshDomains(ctx context.Context, instanceID string) error {
	binding, ok := m.binding(instanceID)
	if !ok || len(binding.Policy.AllowedDomains) == 0 {
		return nil
	}
	m.mu.Lock()
	cached, cachedOK := m.domains[instanceID]
	m.mu.Unlock()
	if cachedOK && time.Now().Before(cached.nextRefresh) {
		return nil
	}
	return m.applyBinding(ctx, binding)
}
