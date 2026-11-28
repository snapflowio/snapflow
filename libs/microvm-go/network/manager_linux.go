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
	"log/slog"
	"net"
	"net/netip"
	"os"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/snapflowio/microvm-go/internal/netrules"
	"github.com/vishvananda/netlink"
	"github.com/vishvananda/netns"
	"golang.org/x/sys/unix"
)

type Manager struct {
	config   Config
	transit  netip.Prefix
	slots    *slotRegistry
	firewall firewallIntegration

	mu            sync.Mutex
	bindings      map[string]PolicyBinding
	domains       map[string]domainCache
	denied        []netip.Prefix
	public        []netip.Addr
	traffic       TrafficPolicy
	resolver      *resolverGuard
	pool          []netip.Addr
	poolCheckedAt time.Time
	inspectors    map[string]*stratumInspector
}

func NewManager(config Config) *Manager {
	config = config.Normalized()
	transit, err := netip.ParsePrefix(config.Transit)
	if err != nil {
		slog.Error("invalid sandbox transit range; sandbox networking is disabled", "transit", config.Transit, "error", err)
		config.Enabled = false
	}
	transit = transit.Masked()
	return &Manager{
		config:     config,
		transit:    transit,
		slots:      newSlotRegistry(slotCapacity(transit)),
		firewall:   firewallIntegration{vethPrefix: VethPrefix, transit: transit.String()},
		bindings:   make(map[string]PolicyBinding),
		domains:    make(map[string]domainCache),
		inspectors: make(map[string]*stratumInspector),
	}
}

func (m *Manager) Capacity() int64 {
	if !m.config.Enabled {
		return 0
	}
	return int64(slotCapacity(m.transit))
}

func (m *Manager) Allocate(ctx context.Context, id string) (*Allocation, error) {
	if !m.config.Enabled {
		return nil, nil
	}
	slot, err := m.slots.reserve(id)
	if err != nil {
		return nil, err
	}
	allocation, err := allocationFor(id, slot, m.transit, m.config.DNS)
	if err != nil {
		m.slots.release(id)
		return nil, err
	}
	if err := m.ensureHost(ctx); err != nil {
		m.slots.release(id)
		return nil, err
	}
	if err := m.buildNamespace(ctx, id, allocation, noNamespaceOwner); err != nil {
		return nil, errors.Join(err, m.Release(ctx, &allocation))
	}
	return &allocation, nil
}

func (m *Manager) buildNamespace(ctx context.Context, id string, allocation Allocation, owner int) error {
	ns, err := openNamespace(allocation.Namespace, owner)
	if err != nil {
		return err
	}
	defer ns.Close()
	if err := wireNamespace(ns, id, allocation); err != nil {
		return err
	}
	if err := m.ensureInspector(ctx, id, allocation.Namespace); err != nil {
		slog.WarnContext(ctx, "could not start stratum inspection; sandbox traffic is not inspected", "instance_id", id, "error", err)
	}
	binding, bound := m.binding(id)
	if !bound {
		binding = PolicyBinding{
			InstanceID: id, Namespace: allocation.Namespace, DNS: allocation.DNS,
			TransitSandbox: allocation.TransitSandbox, TransitHost: allocation.TransitHost,
		}
	}
	return m.applySandboxRules(ns, binding, nil)
}

func (m *Manager) Release(ctx context.Context, allocation *Allocation) error {
	if allocation == nil || allocation.Namespace == "" {
		return nil
	}
	id := strings.TrimPrefix(allocation.Namespace, namespacePrefix)
	err := errors.Join(m.stopInspector(id), deleteNamespace(allocation.Namespace), deleteLink(allocation.HostVeth))
	m.slots.release(id)
	m.mu.Lock()
	delete(m.bindings, id)
	delete(m.domains, id)
	resolver := m.resolver
	m.mu.Unlock()
	if resolver != nil {
		resolver.forget(id)
	}
	slog.DebugContext(ctx, "released instance network", "namespace", allocation.Namespace)
	return errors.Join(err, m.applyHost())
}

func (m *Manager) Reconcile(ctx context.Context, allocations map[string]Allocation, owners map[string]int) error {
	if !m.config.Enabled {
		return nil
	}
	if err := m.slots.replace(allocations); err != nil {
		return err
	}
	if err := m.ensureHost(ctx); err != nil {
		return err
	}
	var failures []error
	expectedNamespaces := make(map[string]struct{}, len(allocations))
	expectedVeths := make(map[string]struct{}, len(allocations))
	for id, allocation := range allocations {
		if err := ctx.Err(); err != nil {
			return err
		}
		expectedNamespaces[allocation.Namespace] = struct{}{}
		expectedVeths[allocation.HostVeth] = struct{}{}
		if err := m.buildNamespace(ctx, id, allocation, owners[id]); err != nil {
			failures = append(failures, fmt.Errorf("restore network of instance %s: %w", id, err))
		}
	}
	failures = append(failures, removeOrphans(expectedNamespaces, expectedVeths)...)
	return errors.Join(failures...)
}

func removeOrphans(namespaces, veths map[string]struct{}) []error {
	var failures []error
	entries, err := os.ReadDir(namespaceDirectory)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		failures = append(failures, fmt.Errorf("list network namespaces: %w", err))
	}
	for _, entry := range entries {
		name := entry.Name()
		if _, expected := namespaces[name]; expected || !strings.HasPrefix(name, namespacePrefix) {
			continue
		}
		if err := deleteNamespace(name); err != nil {
			failures = append(failures, err)
		}
	}
	links, err := netlink.LinkList()
	if err != nil {
		return append(failures, fmt.Errorf("list host links: %w", err))
	}
	for _, link := range links {
		name := link.Attrs().Name
		if _, expected := veths[name]; expected || !strings.HasPrefix(name, VethPrefix) {
			continue
		}
		if err := deleteLink(name); err != nil {
			failures = append(failures, err)
		}
	}
	return failures
}

func deleteLink(name string) error {
	if name == "" {
		return nil
	}
	return deleteLinkWith(&netlink.Handle{}, name)
}

func (m *Manager) Maintain(ctx context.Context) error {
	if !m.config.Enabled {
		return nil
	}
	if err := m.ensureHost(ctx); err != nil {
		return err
	}
	m.mu.Lock()
	public := m.public
	m.mu.Unlock()
	denied, err := deniedDestinations(public)
	if err != nil {
		return err
	}
	poolChanged := m.refreshPool(ctx)
	m.mu.Lock()
	changed := poolChanged || !slices.Equal(denied, m.denied)
	m.denied = denied
	bindings := make([]PolicyBinding, 0, len(m.bindings))
	for _, binding := range m.bindings {
		bindings = append(bindings, binding)
	}
	m.mu.Unlock()
	if !changed {
		return nil
	}
	var failures []error
	for _, binding := range bindings {
		if err := m.applyBinding(ctx, binding); err != nil {
			failures = append(failures, err)
		}
	}
	return errors.Join(failures...)
}

func (m *Manager) ensureHost(ctx context.Context) error {
	if err := m.applyHost(); err != nil {
		return err
	}
	if err := m.firewall.ensure(ctx); err != nil {
		slog.WarnContext(ctx, "could not integrate with the host firewall; sandboxes may lack internet access", "error", err)
	}
	if err := m.ensureResolver(ctx); err != nil {
		return fmt.Errorf("start the sandbox DNS guard; sandbox networking stays off without it: %w", err)
	}
	return nil
}

func (m *Manager) applyHost() error {
	if !m.config.Enabled {
		return nil
	}
	m.mu.Lock()
	var peers []netrules.PeerLink
	for _, binding := range m.bindings {
		own, ownErr := netip.ParseAddr(binding.TransitSandbox)
		for _, peer := range binding.PeerTransits {
			address, err := netip.ParseAddr(peer)
			if ownErr == nil && err == nil && own.Less(address) {
				peers = append(peers, netrules.PeerLink{Left: own, Right: address})
			}
		}
	}
	traffic := m.traffic
	resolverPort := m.resolverPort()
	m.mu.Unlock()
	uplinks, err := defaultRouteInterfaces()
	if err != nil {
		return err
	}
	return errors.Join(
		netrules.ApplyHost(netrules.Host{
			VethPrefix: VethPrefix, Transit: m.transit, Peers: peers,
			HostServices: m.config.HostServicePorts, ResolverPort: resolverPort, Uplinks: uplinks,
		}),
		applyHouseholdCap(traffic),
	)
}

func defaultRouteInterfaces() ([]string, error) {
	routes, err := netlink.RouteList(nil, netlink.FAMILY_V4)
	if err != nil {
		return nil, fmt.Errorf("list host routes: %w", err)
	}
	var uplinks []string
	for _, route := range routes {
		if route.Dst != nil {
			if ones, _ := route.Dst.Mask.Size(); ones != 0 {
				continue
			}
		}
		link, err := netlink.LinkByIndex(route.LinkIndex)
		if err != nil {
			return nil, fmt.Errorf("look up the uplink of the default route: %w", err)
		}
		uplinks = append(uplinks, link.Attrs().Name)
	}
	slices.Sort(uplinks)
	return slices.Compact(uplinks), nil
}

func (m *Manager) SetPublicAddresses(ctx context.Context, addresses []netip.Addr) error {
	public := slices.Clone(addresses)
	slices.SortFunc(public, netip.Addr.Compare)
	public = slices.Compact(public)
	m.mu.Lock()
	unchanged := slices.Equal(public, m.public)
	m.public = public
	m.mu.Unlock()
	if unchanged {
		return nil
	}
	return m.Maintain(ctx)
}

func deniedDestinations(public []netip.Addr) ([]netip.Prefix, error) {
	addresses, err := netlink.AddrList(nil, netlink.FAMILY_V4)
	if err != nil {
		return nil, fmt.Errorf("list host addresses: %w", err)
	}
	denied := netrules.ProtectedDestinations()
	for _, address := range public {
		denied = append(denied, netip.PrefixFrom(address, address.BitLen()))
	}
	for _, address := range addresses {
		parsed, ok := netip.AddrFromSlice(address.IP.To4())
		if !ok {
			continue
		}
		ones, _ := address.Mask.Size()
		denied = append(denied, netip.PrefixFrom(parsed, parsed.BitLen()), netip.PrefixFrom(parsed, ones).Masked())
	}
	slices.SortFunc(denied, func(left, right netip.Prefix) int { return strings.Compare(left.String(), right.String()) })
	return slices.Compact(denied), nil
}

func (m *Manager) ReadMeter(ctx context.Context, allocation *Allocation) (MeterReading, error) {
	if !m.config.Enabled || allocation == nil || allocation.Namespace == "" {
		return MeterReading{}, nil
	}
	if err := m.refreshDomains(ctx, strings.TrimPrefix(allocation.Namespace, namespacePrefix)); err != nil {
		return MeterReading{}, err
	}
	ns, err := netns.GetFromName(allocation.Namespace)
	if errors.Is(err, os.ErrNotExist) {
		return MeterReading{}, nil
	}
	if err != nil {
		return MeterReading{}, fmt.Errorf("open network namespace %s: %w", allocation.Namespace, err)
	}
	defer ns.Close()
	counters, err := netrules.ReadSandboxCounters(int(ns))
	if err != nil {
		return MeterReading{}, err
	}
	byteCount := func(name string) uint64 { return counters[name].Bytes }
	handle, err := netlink.NewHandleAt(ns)
	if err != nil {
		return MeterReading{}, fmt.Errorf("open sandbox namespace netlink handle: %w", err)
	}
	defer handle.Close()
	tap, err := handle.LinkByName(TAPName)
	if isLinkNotFound(err) {
		return MeterReading{}, nil
	}
	if err != nil {
		return MeterReading{}, fmt.Errorf("find guest TAP: %w", err)
	}
	if tap.Attrs().Statistics == nil {
		return MeterReading{}, nil
	}
	statistics := tap.Attrs().Statistics
	return MeterReading{
		InternetEgressBytes:  byteCount(netrules.CounterInternetEgress),
		InternetIngressBytes: byteCount(netrules.CounterInternetIngress),
		HostEgressBytes:      byteCount(netrules.CounterHostEgress),
		HostIngressBytes:     byteCount(netrules.CounterHostIngress),
		TapEgressBytes:       statistics.RxBytes,
		TapIngressBytes:      statistics.TxBytes,
		Available:            true,
	}, nil
}

func (m *Manager) DialGuest(ctx context.Context, allocation Allocation, networkName string, port int) (net.Conn, error) {
	ns, err := netns.GetFromName(allocation.Namespace)
	if err != nil {
		return nil, fmt.Errorf("open network namespace %s: %w", allocation.Namespace, err)
	}
	defer ns.Close()
	var connection net.Conn
	err = inNamespace(ns, func() error {
		dialed, dialErr := (&net.Dialer{}).DialContext(ctx, networkName, net.JoinHostPort(allocation.IP, strconv.Itoa(port)))
		connection = dialed
		return dialErr
	})
	return connection, err
}

func (m *Manager) binding(id string) (PolicyBinding, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	binding, ok := m.bindings[id]
	return binding, ok
}

func isLinkNotFound(err error) bool {
	var notFound netlink.LinkNotFoundError
	return errors.As(err, &notFound) || errors.Is(err, unix.ENODEV)
}

type domainCache struct {
	prefixes    []netip.Prefix
	nextRefresh time.Time
}
