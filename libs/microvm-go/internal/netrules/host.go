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
	"net/netip"
	"slices"

	"github.com/google/nftables"
	"github.com/google/nftables/expr"
	"golang.org/x/sys/unix"
)

const hostTableName = "snapflow_host"

var ErrInvalidHost = errors.New("invalid host network rules")

// PeerLink lets two linked sandboxes reach each other through the host.
type PeerLink struct {
	Left  netip.Addr
	Right netip.Addr
}

// Host is the host namespace's part: forward sandbox traffic to the uplink,
// never into another sandbox or the host itself, and masquerade the transit
// range. It is defense in depth; the sandbox namespaces already drop all of
// this, and this table only adds drops plus the accepts that route traffic.
type Host struct {
	VethPrefix string
	Transit    netip.Prefix
	Peers      []PeerLink
	// HostServices are the host TCP ports sandbox namespaces forward to.
	HostServices []uint16
}

// ApplyHost writes the host table atomically into the caller's namespace.
func ApplyHost(host Host) error {
	if host.VethPrefix == "" || !host.Transit.Addr().Is4() {
		return fmt.Errorf("%w: a veth prefix and an IPv4 transit range are required", ErrInvalidHost)
	}
	batch, err := newRulesetBatch(hostNamespace)
	if err != nil {
		return err
	}
	table := batch.addTable(&nftables.Table{Name: hostTableName, Family: nftables.TableFamilyIPv4})
	acceptPolicy := nftables.ChainPolicyAccept
	chain := func(name string, chainType nftables.ChainType, hook *nftables.ChainHook, priority *nftables.ChainPriority) *nftables.Chain {
		created := batch.addChain(&nftables.Chain{
			Name: name, Table: table, Type: chainType, Hooknum: hook, Priority: priority, Policy: &acceptPolicy,
		})
		batch.flushChain(created)
		return created
	}
	input := chain(inputChainName, nftables.ChainTypeFilter, nftables.ChainHookInput, nftables.ChainPriorityFilter)
	forward := chain(forwardChainName, nftables.ChainTypeFilter, nftables.ChainHookForward, nftables.ChainPriorityFilter)
	postrouting := chain(postroutingChain, nftables.ChainTypeNAT, nftables.ChainHookPostrouting, nftables.ChainPriorityNATSource)

	fromSandbox := interfacePrefixMatch(expr.MetaKeyIIFNAME, host.VethPrefix)
	toSandbox := interfacePrefixMatch(expr.MetaKeyOIFNAME, host.VethPrefix)
	for _, port := range host.HostServices {
		batch.addRule(rule(table, input, fromSandbox, portMatch(unix.IPPROTO_TCP, singlePort(port)), verdict(accept())))
	}
	batch.addRule(rule(table, input, fromSandbox, verdict(drop())))
	for _, link := range host.Peers {
		for _, pair := range [][2]netip.Addr{{link.Left, link.Right}, {link.Right, link.Left}} {
			batch.addRule(rule(table, forward, fromSandbox, toSandbox,
				addressMatch(ipv4SourceOffset, hostPrefix(pair[0]), expr.CmpOpEq),
				addressMatch(ipv4DestinationOffset, hostPrefix(pair[1]), expr.CmpOpEq), verdict(accept())))
		}
	}
	batch.addRule(rule(table, forward, fromSandbox, toSandbox, establishedMatch(), verdict(accept())))
	batch.addRule(rule(table, forward, fromSandbox, toSandbox, verdict(drop())))
	batch.addRule(rule(table, forward, toSandbox, establishedMatch(), verdict(accept())))
	batch.addRule(rule(table, forward, toSandbox, verdict(drop())))
	batch.addRule(rule(table, forward, fromSandbox, addressMatch(ipv4SourceOffset, host.Transit, expr.CmpOpEq), verdict(accept())))
	batch.addRule(rule(table, forward, fromSandbox, verdict(drop())))
	batch.addRule(rule(table, postrouting,
		addressMatch(ipv4SourceOffset, host.Transit, expr.CmpOpEq),
		interfacePrefixCompare(expr.MetaKeyOIFNAME, host.VethPrefix, expr.CmpOpNeq),
		[]expr.Any{&expr.Masq{}}))
	if err := batch.flush(); err != nil {
		return fmt.Errorf("commit host network rules: %w", err)
	}
	return nil
}

// RemoveHost deletes the host table, for uninstall.
func RemoveHost() error {
	batch, err := newRulesetBatch(hostNamespace)
	if err != nil {
		return err
	}
	tables, err := batch.connection.ListTablesOfFamily(nftables.TableFamilyIPv4)
	if err != nil {
		return fmt.Errorf("list host network tables: %w", err)
	}
	index := slices.IndexFunc(tables, func(table *nftables.Table) bool { return table.Name == hostTableName })
	if index < 0 {
		return nil
	}
	batch.delTable(tables[index])
	if err := batch.flush(); err != nil {
		return fmt.Errorf("remove host network rules: %w", err)
	}
	return nil
}
