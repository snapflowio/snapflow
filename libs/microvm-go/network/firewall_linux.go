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
	"os/exec"

	"github.com/snapflowio/microvm-go/internal/hosttool"
)

const (
	iptablesCommand     = "iptables"
	firewalldCommand    = "firewall-cmd"
	firewalldTrusted    = "trusted"
	integrationComment  = "snapflow-sandboxes"
	vethWildcardSuffix  = "+"
	firstRulePosition   = "1"
	establishedStates   = "RELATED,ESTABLISHED"
	commandSuccessCheck = "-C"
	commandInsert       = "-I"
)

// firewallIntegration keeps other host firewalls from dropping sandbox
// traffic. A drop in any netfilter base chain beats our accept, so the only
// portable fix is an accept inside each framework's own chains. Docker, UFW
// and plain iptables all filter in iptables FORWARD; firewalld filters in its
// own table and trusts sources added to its trusted zone. None of these rules
// carry security weight: sandbox namespaces enforce every drop themselves.
type firewallIntegration struct {
	vethPrefix string
	transit    string
}

// ensure re-applies every integration; frameworks that rebuild their chains
// (Docker restarts, ufw reload) lose foreign rules, so the network manager
// calls this periodically.
func (integration firewallIntegration) ensure(ctx context.Context) error {
	return errors.Join(integration.ensureIptables(ctx), integration.ensureFirewalld(ctx))
}

func (integration firewallIntegration) ensureIptables(ctx context.Context) error {
	if _, err := exec.LookPath(iptablesCommand); err != nil {
		return nil
	}
	interfaces := integration.vethPrefix + vethWildcardSuffix
	rules := [][]string{
		{"FORWARD", "-o", interfaces, "-m", "conntrack", "--ctstate", establishedStates, "-m", "comment", "--comment", integrationComment, "-j", "ACCEPT"},
		{"FORWARD", "-i", interfaces, "-m", "comment", "--comment", integrationComment, "-j", "ACCEPT"},
	}
	var failures []error
	for _, rule := range rules {
		if run(ctx, iptablesCommand, append([]string{commandSuccessCheck}, rule...)...) == nil {
			continue
		}
		insert := append([]string{commandInsert, rule[0], firstRulePosition}, rule[1:]...)
		if err := run(ctx, iptablesCommand, insert...); err != nil {
			failures = append(failures, fmt.Errorf("allow sandbox traffic through iptables FORWARD: %w", err))
		}
	}
	return errors.Join(failures...)
}

func (integration firewallIntegration) ensureFirewalld(ctx context.Context) error {
	if _, err := exec.LookPath(firewalldCommand); err != nil {
		return nil
	}
	if run(ctx, firewalldCommand, "--state") != nil {
		return nil
	}
	source := "--add-source=" + integration.transit
	zone := "--zone=" + firewalldTrusted
	if run(ctx, firewalldCommand, zone, "--query-source="+integration.transit) == nil {
		return nil
	}
	if err := run(ctx, firewalldCommand, zone, source); err != nil {
		return fmt.Errorf("trust sandbox transit range in firewalld: %w", err)
	}
	if err := run(ctx, firewalldCommand, "--permanent", zone, source); err != nil {
		return fmt.Errorf("persist sandbox transit range in firewalld: %w", err)
	}
	return nil
}

func run(ctx context.Context, name string, arguments ...string) error {
	output, err := exec.CommandContext(ctx, name, arguments...).CombinedOutput()
	if err != nil {
		return hosttool.Failure(err, string(output))
	}
	return nil
}
