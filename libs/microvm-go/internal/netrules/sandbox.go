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

package netrules

import (
	"errors"
	"fmt"
	"net"
	"net/netip"

	"github.com/google/nftables"
	"github.com/google/nftables/expr"
	"golang.org/x/sys/unix"
)

const (
	sandboxTableName   = "snapflow"
	ingressTableName   = "snapflow_ingress"
	ingressChainName   = "spoofing"
	inputChainName     = "input"
	outputChainName    = "output"
	forwardChainName   = "forward"
	preroutingChain    = "prerouting"
	postroutingChain   = "postrouting"
	loopbackInterface  = "lo"
	ingressPriority    = nftables.ChainPriority(-500)
	natRegisterAddress = 1

	CounterInternetEgress  = "internet_egress"
	CounterInternetIngress = "internet_ingress"
	CounterHostEgress      = "host_egress"
	CounterHostIngress     = "host_ingress"
)

// Counters returns the named counters every sandbox namespace keeps.
func Counters() []string {
	return []string{CounterInternetEgress, CounterInternetIngress, CounterHostEgress, CounterHostIngress}
}

var ErrInvalidSandbox = errors.New("invalid sandbox network rules")

// Policy is a sandbox's egress policy, already resolved to addresses.
type Policy struct {
	BlockAll bool
	Allowed  []netip.Prefix
	// Restricted drops everything not in Allowed, which a domain allow list
	// needs even while its names have not resolved yet.
	Restricted bool
}

// Sandbox is the complete rule set of one sandbox network namespace. Every
// security decision lives here, where no other tool on the host writes.
type Sandbox struct {
	TAP       string
	Uplink    string
	GuestMAC  net.HardwareAddr
	GuestIP   netip.Addr
	TransitIP netip.Addr
	// Resolver is the DNS server guests may query despite the UDP 53 guard.
	Resolver netip.Addr
	// Denied destinations: protected ranges plus every host address and
	// connected subnet, refreshed as the host's addresses change.
	Denied []netip.Prefix
	// Peers are the transit addresses of linked sandboxes, reachable in both
	// directions despite Denied.
	Peers  []netip.Addr
	Policy Policy
	// HostServices are host TCP ports a guest may reach at its gateway address,
	// forwarded to the host end of the transit pair. Production exposes none.
	HostServices []uint16
	Gateway      netip.Addr
	HostTransit  netip.Addr
}

func (sandbox Sandbox) validate() error {
	switch {
	case sandbox.TAP == "" || sandbox.Uplink == "":
		return fmt.Errorf("%w: TAP and uplink interfaces are required", ErrInvalidSandbox)
	case len(sandbox.GuestMAC) != etherAddressBytes:
		return fmt.Errorf("%w: guest MAC %q", ErrInvalidSandbox, sandbox.GuestMAC)
	case len(sandbox.HostServices) > 0 && (!sandbox.Gateway.Is4() || !sandbox.HostTransit.Is4()):
		return fmt.Errorf("%w: host services need the gateway and host transit addresses", ErrInvalidSandbox)
	case !sandbox.GuestIP.Is4() || !sandbox.TransitIP.Is4() || !sandbox.Resolver.Is4():
		return fmt.Errorf("%w: guest, transit and resolver addresses must be IPv4", ErrInvalidSandbox)
	}
	return nil
}

// ApplySandbox writes the sandbox rules into the namespace behind
// namespaceFd in one atomic batch. Chains are flushed and rebuilt, never
// deleted, so the named counters keep counting across policy updates.
func ApplySandbox(namespaceFd int, sandbox Sandbox) error {
	if err := sandbox.validate(); err != nil {
		return err
	}
	batch, err := newRulesetBatch(namespaceFd)
	if err != nil {
		return err
	}
	addIngressRules(batch, sandbox)
	addFilterRules(batch, sandbox)
	if err := batch.flush(); err != nil {
		return fmt.Errorf("commit sandbox network rules: %w", err)
	}
	return nil
}

// addIngressRules drops every frame from the guest except IPv4 from its own
// address and MAC and ARP claiming them, before routing sees it.
func addIngressRules(batch *rulesetBatch, sandbox Sandbox) {
	table := batch.addTable(&nftables.Table{Name: ingressTableName, Family: nftables.TableFamilyNetdev})
	dropPolicy := nftables.ChainPolicyDrop
	chain := batch.addChain(&nftables.Chain{
		Name: ingressChainName, Table: table, Type: nftables.ChainTypeFilter,
		Hooknum: nftables.ChainHookIngress, Priority: nftables.ChainPriorityRef(ingressPriority),
		Device: sandbox.TAP, Policy: &dropPolicy,
	})
	batch.flushChain(chain)
	guestIP := sandbox.GuestIP.As4()
	batch.addRule(rule(table, chain,
		etherSourceMatch(sandbox.GuestMAC), etherTypeMatch(etherTypeIPv4),
		networkHeaderMatch(ipv4SourceOffset, ipv4AddressBytes, guestIP[:]), verdict(accept())))
	batch.addRule(rule(table, chain,
		etherSourceMatch(sandbox.GuestMAC), etherTypeMatch(etherTypeARP),
		networkHeaderMatch(arpSenderMACOffset, etherAddressBytes, sandbox.GuestMAC),
		networkHeaderMatch(arpSenderIPOffset, ipv4AddressBytes, guestIP[:]), verdict(accept())))
}

func addFilterRules(batch *rulesetBatch, sandbox Sandbox) {
	table := batch.addTable(&nftables.Table{Name: sandboxTableName, Family: nftables.TableFamilyIPv4})
	for _, name := range Counters() {
		batch.addObject(&nftables.CounterObj{Table: table, Name: name})
	}
	dropPolicy := nftables.ChainPolicyDrop
	acceptPolicy := nftables.ChainPolicyAccept
	filter := func(name string, hook *nftables.ChainHook, policy *nftables.ChainPolicy) *nftables.Chain {
		chain := batch.addChain(&nftables.Chain{
			Name: name, Table: table, Type: nftables.ChainTypeFilter,
			Hooknum: hook, Priority: nftables.ChainPriorityFilter, Policy: policy,
		})
		batch.flushChain(chain)
		return chain
	}
	nat := func(name string, hook *nftables.ChainHook, priority *nftables.ChainPriority) *nftables.Chain {
		chain := batch.addChain(&nftables.Chain{
			Name: name, Table: table, Type: nftables.ChainTypeNAT, Hooknum: hook, Priority: priority,
		})
		batch.flushChain(chain)
		return chain
	}
	addInputRules(batch, table, filter(inputChainName, nftables.ChainHookInput, &dropPolicy), sandbox)
	addOutputRules(batch, table, filter(outputChainName, nftables.ChainHookOutput, &acceptPolicy), sandbox)
	addForwardRules(batch, table, filter(forwardChainName, nftables.ChainHookForward, &dropPolicy), sandbox)
	addPeerTranslation(batch, table, nat(preroutingChain, nftables.ChainHookPrerouting, nftables.ChainPriorityNATDest), sandbox)
	addSourceTranslation(batch, table, nat(postroutingChain, nftables.ChainHookPostrouting, nftables.ChainPriorityNATSource), sandbox)
}

// addInputRules lets the guest answer connections the daemon opened to it and
// nothing else: a guest can never start a connection to its namespace.
func addInputRules(batch *rulesetBatch, table *nftables.Table, chain *nftables.Chain, sandbox Sandbox) {
	batch.addRule(rule(table, chain, interfaceMatch(expr.MetaKeyIIFNAME, loopbackInterface, expr.CmpOpEq), verdict(accept())))
	batch.addRule(rule(table, chain,
		interfaceMatch(expr.MetaKeyIIFNAME, sandbox.TAP, expr.CmpOpEq), establishedMatch(),
		verdict(countInto(CounterHostEgress)), verdict(accept())))
}

func addOutputRules(batch *rulesetBatch, table *nftables.Table, chain *nftables.Chain, sandbox Sandbox) {
	batch.addRule(rule(table, chain,
		interfaceMatch(expr.MetaKeyOIFNAME, sandbox.TAP, expr.CmpOpEq),
		verdict(countInto(CounterHostIngress)), verdict(accept())))
}

func addForwardRules(batch *rulesetBatch, table *nftables.Table, chain *nftables.Chain, sandbox Sandbox) {
	fromGuest := interfaceMatch(expr.MetaKeyIIFNAME, sandbox.TAP, expr.CmpOpEq)
	toGuest := interfaceMatch(expr.MetaKeyOIFNAME, sandbox.TAP, expr.CmpOpEq)
	egress := []expr.Any{countInto(CounterInternetEgress), accept()}
	batch.addRule(rule(table, chain, fromGuest, establishedMatch(), egress))
	batch.addRule(rule(table, chain, toGuest, establishedMatch(), verdict(countInto(CounterInternetIngress)), verdict(accept())))
	for _, peer := range sandbox.Peers {
		batch.addRule(rule(table, chain,
			interfaceMatch(expr.MetaKeyIIFNAME, sandbox.Uplink, expr.CmpOpEq),
			addressMatch(ipv4SourceOffset, hostPrefix(peer), expr.CmpOpEq),
			toGuest, verdict(countInto(CounterInternetIngress)), verdict(accept())))
	}
	batch.addRule(rule(table, chain, interfaceMatch(expr.MetaKeyIIFNAME, sandbox.TAP, expr.CmpOpNeq), verdict(drop())))
	for _, port := range sandbox.HostServices {
		batch.addRule(rule(table, chain,
			addressMatch(ipv4DestinationOffset, hostPrefix(sandbox.HostTransit), expr.CmpOpEq),
			portMatch(unix.IPPROTO_TCP, singlePort(port)), egress))
	}
	if sandbox.Policy.BlockAll {
		batch.addRule(rule(table, chain, verdict(drop())))
		return
	}
	for _, peer := range sandbox.Peers {
		batch.addRule(rule(table, chain, addressMatch(ipv4DestinationOffset, hostPrefix(peer), expr.CmpOpEq), egress))
	}
	batch.addRule(rule(table, chain, addressMatch(ipv4DestinationOffset, hostPrefix(sandbox.Resolver), expr.CmpOpEq), egress))
	for _, prefix := range sandbox.Denied {
		batch.addRule(rule(table, chain, addressMatch(ipv4DestinationOffset, prefix, expr.CmpOpEq), verdict(drop())))
	}
	for _, port := range blockedTCPPorts() {
		action := drop()
		if port == singlePort(smtpPort) {
			action = rejectTCP()
		}
		batch.addRule(rule(table, chain, portMatch(unix.IPPROTO_TCP, port), verdict(action)))
	}
	for _, port := range blockedUDPPorts() {
		batch.addRule(rule(table, chain, portMatch(unix.IPPROTO_UDP, port), verdict(drop())))
	}
	for _, prefix := range sandbox.Policy.Allowed {
		batch.addRule(rule(table, chain, addressMatch(ipv4DestinationOffset, prefix, expr.CmpOpEq), egress))
	}
	if !sandbox.Policy.Restricted && len(sandbox.Policy.Allowed) == 0 {
		batch.addRule(rule(table, chain, egress))
	}
}

// addPeerTranslation delivers a linked peer's traffic for this sandbox's
// transit address to the guest.
func addPeerTranslation(batch *rulesetBatch, table *nftables.Table, chain *nftables.Chain, sandbox Sandbox) {
	guestIP := sandbox.GuestIP.As4()
	hostTransit := sandbox.HostTransit.As4()
	for _, port := range sandbox.HostServices {
		batch.addRule(rule(table, chain,
			interfaceMatch(expr.MetaKeyIIFNAME, sandbox.TAP, expr.CmpOpEq),
			addressMatch(ipv4DestinationOffset, hostPrefix(sandbox.Gateway), expr.CmpOpEq),
			portMatch(unix.IPPROTO_TCP, singlePort(port)),
			[]expr.Any{
				&expr.Immediate{Register: natRegisterAddress, Data: hostTransit[:]},
				&expr.NAT{Type: expr.NATTypeDestNAT, Family: unix.NFPROTO_IPV4, RegAddrMin: natRegisterAddress},
			}))
	}
	for _, peer := range sandbox.Peers {
		batch.addRule(rule(table, chain,
			interfaceMatch(expr.MetaKeyIIFNAME, sandbox.Uplink, expr.CmpOpEq),
			addressMatch(ipv4SourceOffset, hostPrefix(peer), expr.CmpOpEq),
			addressMatch(ipv4DestinationOffset, hostPrefix(sandbox.TransitIP), expr.CmpOpEq),
			[]expr.Any{
				&expr.Immediate{Register: natRegisterAddress, Data: guestIP[:]},
				&expr.NAT{Type: expr.NATTypeDestNAT, Family: unix.NFPROTO_IPV4, RegAddrMin: natRegisterAddress},
			}))
	}
}

// addSourceTranslation hides the guest behind the namespace's transit address.
func addSourceTranslation(batch *rulesetBatch, table *nftables.Table, chain *nftables.Chain, sandbox Sandbox) {
	transitIP := sandbox.TransitIP.As4()
	batch.addRule(rule(table, chain,
		interfaceMatch(expr.MetaKeyOIFNAME, sandbox.Uplink, expr.CmpOpEq),
		addressMatch(ipv4SourceOffset, hostPrefix(sandbox.GuestIP), expr.CmpOpEq),
		[]expr.Any{
			&expr.Immediate{Register: natRegisterAddress, Data: transitIP[:]},
			&expr.NAT{Type: expr.NATTypeSourceNAT, Family: unix.NFPROTO_IPV4, RegAddrMin: natRegisterAddress},
		}))
}

// ReadSandboxCounters returns the byte totals of a namespace's counters.
func ReadSandboxCounters(namespaceFd int) (map[string]uint64, error) {
	batch, err := newRulesetBatch(namespaceFd)
	if err != nil {
		return nil, err
	}
	objects, err := batch.connection.GetNamedObjects(&nftables.Table{Name: sandboxTableName, Family: nftables.TableFamilyIPv4})
	if err != nil {
		return nil, fmt.Errorf("read sandbox counters: %w", err)
	}
	totals := make(map[string]uint64, len(objects))
	for _, object := range objects {
		if counter, ok := object.(*nftables.CounterObj); ok {
			totals[counter.Name] = counter.Bytes
		}
	}
	return totals, nil
}
