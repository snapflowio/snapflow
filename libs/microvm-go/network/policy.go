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

package network

import (
	"errors"
	"fmt"
	"net/netip"
	"strings"

	"github.com/snapflowio/microvm-go/internal/netrules"
)

var ErrEgressPolicyUnsupported = errors.New("host-enforced instance egress policy is unsupported")

const maxAllowedCIDRs = 64

const (
	MinimumEgressBandwidthBPS = uint64(512 * 1024)
	MaximumEgressBandwidthBPS = uint64(32 * 1000 * 1000 * 1000)
)

type EgressPolicy struct {
	BlockAll           bool
	AllowedCIDRs       []string
	AllowedDomains     []string
	EgressBandwidthBPS uint64
}

// PolicyBinding attaches an egress policy to one instance namespace.
type PolicyBinding struct {
	InstanceID     string
	Namespace      string
	TransitSandbox string
	TransitHost    string
	DNS            string
	// PeerTransits are the transit addresses of linked peers.
	PeerTransits []string
	Policy       EgressPolicy
}

func NewEgressPolicy(blockAll *bool, allowList, domainAllowList *string, bandwidthBPS *uint64) (EgressPolicy, error) {
	bandwidth, err := egressBandwidth(bandwidthBPS)
	if err != nil {
		return EgressPolicy{}, err
	}
	domains, err := parseDomainAllowList(domainAllowList)
	if err != nil {
		return EgressPolicy{}, err
	}
	policy := EgressPolicy{
		BlockAll:           blockAll != nil && *blockAll,
		AllowedDomains:     domains,
		EgressBandwidthBPS: bandwidth,
	}
	if allowList == nil {
		if policy.BlockAll && len(policy.AllowedDomains) > 0 {
			return EgressPolicy{}, errors.New("network block-all and a domain allow list cannot both be enabled")
		}
		return policy, nil
	}
	cidrs, err := parseCIDRAllowList(*allowList)
	if err != nil {
		return EgressPolicy{}, err
	}
	policy.AllowedCIDRs = cidrs
	if policy.BlockAll && (len(policy.AllowedCIDRs) > 0 || len(policy.AllowedDomains) > 0) {
		return EgressPolicy{}, errors.New("network block-all and an allow list cannot both be enabled")
	}
	return policy, nil
}

func egressBandwidth(bandwidthBPS *uint64) (uint64, error) {
	if bandwidthBPS == nil {
		return 0, nil
	}
	if *bandwidthBPS != 0 && (*bandwidthBPS < MinimumEgressBandwidthBPS || *bandwidthBPS > MaximumEgressBandwidthBPS) {
		return 0, fmt.Errorf(
			"egress bandwidth must be between %d and %d bits per second",
			MinimumEgressBandwidthBPS,
			MaximumEgressBandwidthBPS,
		)
	}
	return *bandwidthBPS, nil
}

func parseCIDRAllowList(allowList string) ([]string, error) {
	protected := netrules.ProtectedDestinations()
	var cidrs []string
	for _, value := range strings.Split(allowList, ",") {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		prefix, err := parseAllowedCIDR(value, protected)
		if err != nil {
			return nil, err
		}
		cidrs = append(cidrs, prefix.String())
		if len(cidrs) > maxAllowedCIDRs {
			return nil, fmt.Errorf("network allow list cannot contain more than %d entries", maxAllowedCIDRs)
		}
	}
	return cidrs, nil
}

func parseAllowedCIDR(value string, protected []netip.Prefix) (netip.Prefix, error) {
	prefix, err := netip.ParsePrefix(value)
	if err != nil {
		return netip.Prefix{}, fmt.Errorf("parse network allow-list entry %q: %w", value, err)
	}
	if !prefix.Addr().Is4() {
		return netip.Prefix{}, fmt.Errorf("network allow-list entry %q is not IPv4", value)
	}
	prefix = prefix.Masked()
	for _, destination := range protected {
		if prefix.Overlaps(destination) {
			return netip.Prefix{}, fmt.Errorf("network allow-list entry %q overlaps protected destination %s", value, destination)
		}
	}
	return prefix, nil
}

func (p EgressPolicy) Constrained() bool {
	return p.BlockAll || len(p.AllowedCIDRs) > 0 || len(p.AllowedDomains) > 0 || p.EgressBandwidthBPS > 0
}
