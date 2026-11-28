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

func Counters() []string {
	return []string{CounterInternetEgress, CounterInternetIngress, CounterHostEgress, CounterHostIngress}
}

var ErrInvalidSandbox = errors.New("invalid sandbox network rules")

type Policy struct {
	BlockAll   bool
	Allowed    []netip.Prefix
	Restricted bool
}

type Sandbox struct {
	TAP           string
	Uplink        string
	GuestMAC      net.HardwareAddr
	GuestIP       netip.Addr
	TransitIP     netip.Addr
	Denied        []netip.Prefix
	Peers         []netip.Addr
	Policy        Policy
	HostServices  []uint16
	Gateway       netip.Addr
	HostTransit   netip.Addr
	Limits        Limits
	PoolAddresses []netip.Addr
	ResolverPort  uint16
	StratumQueue  *uint16
}

func (sandbox Sandbox) validate() error {
	switch {
	case sandbox.TAP == "" || sandbox.Uplink == "":
		return fmt.Errorf("%w: TAP and uplink interfaces are required", ErrInvalidSandbox)
	case len(sandbox.GuestMAC) != etherAddressBytes:
		return fmt.Errorf("%w: guest MAC %q", ErrInvalidSandbox, sandbox.GuestMAC)
	case (len(sandbox.HostServices) > 0 || sandbox.ResolverPort != 0) && (!sandbox.Gateway.Is4() || !sandbox.HostTransit.Is4()):
		return fmt.Errorf("%w: host services need the gateway and host transit addresses", ErrInvalidSandbox)
	case !sandbox.GuestIP.Is4() || !sandbox.TransitIP.Is4():
		return fmt.Errorf("%w: guest and transit addresses must be IPv4", ErrInvalidSandbox)
	}
	return nil
}

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

func addIngressRules(batch *rulesetBatch, sandbox Sandbox) {
	table := batch.addTable(&nftables.Table{Name: ingressTableName, Family: nftables.TableFamilyNetdev})
	dropPolicy := nftables.ChainPolicyDrop
	chain := batch.addChain(&nftables.Chain{
		Name: ingressChainName, Table: table, Type: nftables.ChainTypeFilter,
		Hooknum: nftables.ChainHookIngress, Priority: nftables.ChainPriorityRef(ingressPriority),
		Device: sandbox.TAP, Policy: &dropPolicy,
	})
	batch.flushChain(chain)
	addPacketLimit(batch, table, chain, sandbox.Limits)
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
	for _, name := range SandboxCounters() {
		batch.addObject(&nftables.CounterObj{Table: table, Name: name})
	}
	addGuardSets(batch, table, addressElements(sandbox.PoolAddresses))
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
	forward := filter(forwardChainName, nftables.ChainHookForward, &dropPolicy)
	prerouting := nat(preroutingChain, nftables.ChainHookPrerouting, nftables.ChainPriorityNATDest)
	addForwardRules(batch, table, forward, prerouting, sandbox)
	addPeerTranslation(batch, table, prerouting, sandbox)
	addSourceTranslation(batch, table, nat(postroutingChain, nftables.ChainHookPostrouting, nftables.ChainPriorityNATSource), sandbox)
}

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

func addForwardRules(batch *rulesetBatch, table *nftables.Table, chain, prerouting *nftables.Chain, sandbox Sandbox) {
	toGuest := interfaceMatch(expr.MetaKeyOIFNAME, sandbox.TAP, expr.CmpOpEq)
	egress := []expr.Any{countInto(CounterInternetEgress), accept()}
	addEstablishedEgress(batch, table, chain, sandbox)
	for _, peer := range sandbox.Peers {
		batch.addRule(rule(table, chain,
			interfaceMatch(expr.MetaKeyIIFNAME, sandbox.Uplink, expr.CmpOpEq),
			addressMatch(ipv4SourceOffset, hostPrefix(peer), expr.CmpOpEq),
			toGuest, verdict(countInto(CounterInternetIngress)), verdict(accept())))
	}
	batch.addRule(rule(table, chain, interfaceMatch(expr.MetaKeyIIFNAME, sandbox.TAP, expr.CmpOpNeq), verdict(drop())))
	addTrackingRules(batch, table, chain, sandbox)
	for _, port := range sandbox.HostServices {
		batch.addRule(rule(table, chain,
			addressMatch(ipv4DestinationOffset, hostPrefix(sandbox.HostTransit), expr.CmpOpEq),
			portMatch(unix.IPPROTO_TCP, singlePort(port)), egress))
	}
	if sandbox.Policy.BlockAll {
		batch.addRule(rule(table, chain, verdict(drop())))
		return
	}
	addResolverRules(batch, table, chain, prerouting, sandbox)
	for _, peer := range sandbox.Peers {
		batch.addRule(rule(table, chain, addressMatch(ipv4DestinationOffset, hostPrefix(peer), expr.CmpOpEq), egress))
	}
	for _, prefix := range sandbox.Denied {
		batch.addRule(rule(table, chain, addressMatch(ipv4DestinationOffset, prefix, expr.CmpOpEq), verdict(drop())))
	}
	addBlockRules(batch, table, chain)
	for _, port := range blockedTCPPorts() {
		batch.addRule(rule(table, chain, portMatch(unix.IPPROTO_TCP, port), verdict(drop())))
	}
	for _, port := range blockedUDPPorts() {
		batch.addRule(rule(table, chain, portMatch(unix.IPPROTO_UDP, port), []expr.Any{countInto(CounterReflectionBlocked), drop()}))
	}
	for _, prefix := range sandbox.Policy.Allowed {
		batch.addRule(rule(table, chain, addressMatch(ipv4DestinationOffset, prefix, expr.CmpOpEq), egress))
	}
	if !sandbox.Policy.Restricted && len(sandbox.Policy.Allowed) == 0 {
		batch.addRule(rule(table, chain, egress))
	}
}

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

type CounterReading struct {
	Bytes   uint64
	Packets uint64
}

func ReadSandboxCounters(namespaceFd int) (map[string]CounterReading, error) {
	batch, err := newRulesetBatch(namespaceFd)
	if err != nil {
		return nil, err
	}
	totals := make(map[string]CounterReading)
	for _, table := range []*nftables.Table{
		{Name: sandboxTableName, Family: nftables.TableFamilyIPv4},
		{Name: ingressTableName, Family: nftables.TableFamilyNetdev},
	} {
		objects, err := batch.connection.GetNamedObjects(table)
		if err != nil {
			return nil, fmt.Errorf("read sandbox counters of %s: %w", table.Name, err)
		}
		for _, object := range objects {
			named, ok := object.(*nftables.NamedObj)
			if !ok {
				continue
			}
			if counter, ok := named.Obj.(*expr.Counter); ok {
				totals[named.Name] = CounterReading{Bytes: counter.Bytes, Packets: counter.Packets}
			}
		}
	}
	return totals, nil
}

func addressElements(addresses []netip.Addr) []nftables.SetElement {
	elements := make([]nftables.SetElement, 0, len(addresses))
	for _, address := range addresses {
		if address.Is4() {
			encoded := address.As4()
			elements = append(elements, nftables.SetElement{Key: encoded[:]})
		}
	}
	return elements
}
