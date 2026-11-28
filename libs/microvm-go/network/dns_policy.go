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

package network

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/netip"
	"slices"
	"strings"
	"time"

	"github.com/miekg/dns"
	"github.com/snapflowio/microvm-go/internal/netrules"
)

const (
	maxAllowedDomains = 64
	minimumDNSTTL     = 5 * time.Second
	maximumDNSTTL     = 5 * time.Minute
	maxDomainLength   = 253
	maxDomainLabel    = 63
	dnsPort           = "53"
)

func parseDomainAllowList(value *string) ([]string, error) {
	if value == nil {
		return nil, nil
	}
	seen := make(map[string]struct{})
	domains := make([]string, 0)
	for _, candidate := range strings.Split(*value, ",") {
		domain := strings.ToLower(strings.TrimSuffix(strings.TrimSpace(candidate), "."))
		if domain == "" {
			continue
		}
		if strings.Contains(domain, "*") {
			return nil, fmt.Errorf("domain allow-list entry %q uses an unsupported wildcard", candidate)
		}
		if !validDomain(domain) {
			return nil, fmt.Errorf("domain allow-list entry %q is invalid", candidate)
		}
		if _, exists := seen[domain]; exists {
			continue
		}
		seen[domain] = struct{}{}
		domains = append(domains, domain)
		if len(domains) > maxAllowedDomains {
			return nil, fmt.Errorf("domain allow list cannot contain more than %d entries", maxAllowedDomains)
		}
	}
	slices.Sort(domains)
	return domains, nil
}

func validDomain(value string) bool {
	if len(value) == 0 || len(value) > maxDomainLength {
		return false
	}
	for _, label := range strings.Split(value, ".") {
		if len(label) == 0 || len(label) > maxDomainLabel || label[0] == '-' || label[len(label)-1] == '-' {
			return false
		}
		for _, character := range label {
			if (character < 'a' || character > 'z') && (character < '0' || character > '9') && character != '-' {
				return false
			}
		}
	}
	return true
}

type domainResolution struct {
	cidrs []string
	ttl   time.Duration
}

func resolveAllowedDomains(ctx context.Context, dnsServer string, domains []string) (domainResolution, error) {
	if len(domains) == 0 {
		return domainResolution{}, nil
	}
	server, err := trustedDNSEndpoint(dnsServer)
	if err != nil {
		return domainResolution{}, fmt.Errorf("trusted DNS server %q is not an IP address", dnsServer)
	}
	addresses := make(map[netip.Addr]struct{})
	minimumTTL := maximumDNSTTL
	for _, domain := range domains {
		response, err := exchangeDNS(ctx, server, domain)
		if err != nil {
			return domainResolution{}, fmt.Errorf("resolve allowed domain %s: %w", domain, err)
		}
		ttl, err := recordDomainAddresses(domain, response.Answer, addresses)
		if err != nil {
			return domainResolution{}, err
		}
		minimumTTL = min(minimumTTL, ttl)
	}
	cidrs := make([]string, 0, len(addresses))
	for address := range addresses {
		cidrs = append(cidrs, netip.PrefixFrom(address, address.BitLen()).String())
	}
	slices.Sort(cidrs)
	return domainResolution{cidrs: cidrs, ttl: minimumTTL}, nil
}

func recordDomainAddresses(domain string, answers []dns.RR, addresses map[netip.Addr]struct{}) (time.Duration, error) {
	minimumTTL := maximumDNSTTL
	found := false
	for _, answer := range answers {
		record, ok := answer.(*dns.A)
		if !ok {
			continue
		}
		address, ok := netip.AddrFromSlice(record.A)
		if !ok || !address.Is4() {
			continue
		}
		address = address.Unmap()
		if addressIsProtected(address) {
			return 0, fmt.Errorf("allowed domain %s resolved to protected address %s", domain, address)
		}
		addresses[address] = struct{}{}
		minimumTTL = min(minimumTTL, max(time.Duration(record.Hdr.Ttl)*time.Second, minimumDNSTTL))
		found = true
	}
	if !found {
		return 0, fmt.Errorf("allowed domain %s returned no IPv4 addresses", domain)
	}
	return minimumTTL, nil
}

func trustedDNSEndpoint(value string) (string, error) {
	value = strings.TrimSpace(value)
	if addressPort, err := netip.ParseAddrPort(value); err == nil {
		return addressPort.String(), nil
	}
	address, err := netip.ParseAddr(value)
	if err != nil {
		return "", err
	}
	return net.JoinHostPort(address.String(), dnsPort), nil
}

func exchangeDNS(ctx context.Context, server, domain string) (*dns.Msg, error) {
	request := new(dns.Msg)
	request.SetQuestion(dns.Fqdn(domain), dns.TypeA)
	client := &dns.Client{Net: "udp"}
	response, _, err := client.ExchangeContext(ctx, request, server)
	if err != nil {
		return nil, err
	}
	if response.Truncated {
		client.Net = "tcp"
		response, _, err = client.ExchangeContext(ctx, request, server)
		if err != nil {
			return nil, err
		}
	}
	if response.Rcode != dns.RcodeSuccess {
		return nil, fmt.Errorf("DNS response code %s", dns.RcodeToString[response.Rcode])
	}
	if len(response.Answer) == 0 {
		return nil, errors.New("empty DNS answer")
	}
	return response, nil
}

func addressIsProtected(address netip.Addr) bool {
	for _, prefix := range netrules.ProtectedDestinations() {
		if prefix.Contains(address) {
			return true
		}
	}
	return false
}
