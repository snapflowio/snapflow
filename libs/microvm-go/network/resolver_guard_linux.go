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
	"log/slog"
	"net"
	"net/netip"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/snapflowio/microvm-go/types"

	"github.com/miekg/dns"
	"golang.org/x/net/publicsuffix"
)

const (
	ResolverGuardPort       = uint16(15353)
	resolverExchangeTimeout = 5 * time.Second
	resolverDomainWindow    = time.Hour
	resolverDomainCapacity  = 4096
	udpNetwork              = "udp"
	tcpNetwork              = "tcp"
)

type resolverStats struct {
	blocked uint64
	domains map[string]time.Time
}

type resolverGuard struct {
	upstream string
	identify func(netip.Addr) (string, bool)

	mu      sync.Mutex
	stats   map[string]*resolverStats
	servers []*dns.Server
}

func newResolverGuard(upstream string, identify func(netip.Addr) (string, bool)) (*resolverGuard, error) {
	endpoint, err := trustedDNSEndpoint(upstream)
	if err != nil {
		return nil, fmt.Errorf("upstream resolver %q is not an IP address: %w", upstream, err)
	}
	return &resolverGuard{upstream: endpoint, identify: identify, stats: make(map[string]*resolverStats)}, nil
}

func (guard *resolverGuard) start(ctx context.Context) error {
	address := net.JoinHostPort("", strconv.Itoa(int(ResolverGuardPort)))
	var listenConfig net.ListenConfig
	packetConn, err := listenConfig.ListenPacket(ctx, udpNetwork, address)
	if err != nil {
		return fmt.Errorf("listen for sandbox DNS on UDP %s: %w", address, err)
	}
	listener, err := listenConfig.Listen(ctx, tcpNetwork, address)
	if err != nil {
		return errors.Join(fmt.Errorf("listen for sandbox DNS on TCP %s: %w", address, err), packetConn.Close())
	}
	guard.servers = []*dns.Server{
		{PacketConn: packetConn, Handler: guard},
		{Listener: listener, Handler: guard},
	}
	for _, server := range guard.servers {
		go func() {
			if err := server.ActivateAndServe(); err != nil {
				slog.Error("the sandbox DNS guard stopped", "error", err)
			}
		}()
	}
	return nil
}

func (guard *resolverGuard) ServeDNS(writer dns.ResponseWriter, request *dns.Msg) {
	response := guard.answer(writer, request)
	if err := writer.WriteMsg(response); err != nil {
		slog.Debug("could not answer a sandbox DNS query", "error", err)
	}
}

func (guard *resolverGuard) answer(writer dns.ResponseWriter, request *dns.Msg) *dns.Msg {
	source, err := netip.ParseAddrPort(writer.RemoteAddr().String())
	if err != nil {
		return failure(request, dns.RcodeRefused)
	}
	instanceID, known := guard.identify(source.Addr().Unmap())
	if !known {
		return failure(request, dns.RcodeRefused)
	}
	for _, question := range request.Question {
		if isMiningPoolDomain(question.Name) {
			guard.record(instanceID, "", true)
			return failure(request, dns.RcodeNameError)
		}
		guard.record(instanceID, question.Name, false)
	}
	ctx, cancel := context.WithTimeout(context.Background(), resolverExchangeTimeout)
	defer cancel()
	client := &dns.Client{Net: writer.RemoteAddr().Network()}
	response, _, err := client.ExchangeContext(ctx, request, guard.upstream)
	if err != nil {
		slog.Debug("the upstream resolver did not answer a sandbox query", "instance_id", instanceID, "error", err)
		return failure(request, dns.RcodeServerFailure)
	}
	return response
}

func failure(request *dns.Msg, code int) *dns.Msg {
	response := new(dns.Msg)
	response.SetRcode(request, code)
	return response
}

func (guard *resolverGuard) record(instanceID, name string, blocked bool) {
	guard.mu.Lock()
	defer guard.mu.Unlock()
	stats, ok := guard.stats[instanceID]
	if !ok {
		stats = &resolverStats{domains: make(map[string]time.Time)}
		guard.stats[instanceID] = stats
	}
	if blocked {
		stats.blocked++
		return
	}
	domain, err := publicsuffix.EffectiveTLDPlusOne(strings.TrimSuffix(strings.ToLower(name), "."))
	if err != nil {
		return
	}
	if _, seen := stats.domains[domain]; seen || len(stats.domains) < resolverDomainCapacity {
		stats.domains[domain] = time.Now()
	}
}

func (guard *resolverGuard) reading(instanceID string) types.ResolverReading {
	guard.mu.Lock()
	defer guard.mu.Unlock()
	stats, ok := guard.stats[instanceID]
	if !ok {
		return types.ResolverReading{}
	}
	cutoff := time.Now().Add(-resolverDomainWindow)
	for domain, seen := range stats.domains {
		if seen.Before(cutoff) {
			delete(stats.domains, domain)
		}
	}
	return types.ResolverReading{BlockedQueries: stats.blocked, DistinctDomains: len(stats.domains)}
}

func (guard *resolverGuard) forget(instanceID string) {
	guard.mu.Lock()
	defer guard.mu.Unlock()
	delete(guard.stats, instanceID)
}

func (guard *resolverGuard) resolvePools(ctx context.Context) []netip.Addr {
	var (
		mu        sync.Mutex
		group     sync.WaitGroup
		failures  []error
		addresses = make(map[netip.Addr]struct{})
	)
	for _, host := range miningPoolHosts() {
		group.Go(func() {
			response, err := exchangeDNS(ctx, guard.upstream, host)
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				failures = append(failures, fmt.Errorf("%s: %w", host, err))
				return
			}
			recordPoolAddresses(response.Answer, addresses)
		})
	}
	group.Wait()
	if len(failures) > 0 {
		slog.DebugContext(ctx, "some mining pool hosts did not resolve", "error", errors.Join(failures...))
	}
	sorted := make([]netip.Addr, 0, len(addresses))
	for address := range addresses {
		sorted = append(sorted, address)
	}
	slices.SortFunc(sorted, netip.Addr.Compare)
	return sorted
}

func recordPoolAddresses(answers []dns.RR, addresses map[netip.Addr]struct{}) {
	for _, answer := range answers {
		record, ok := answer.(*dns.A)
		if !ok {
			continue
		}
		if address, ok := netip.AddrFromSlice(record.A); ok && !addressIsProtected(address.Unmap()) {
			addresses[address.Unmap()] = struct{}{}
		}
	}
}
