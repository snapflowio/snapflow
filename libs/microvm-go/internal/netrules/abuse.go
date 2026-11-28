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

package netrules

import (
	"time"

	"github.com/google/nftables"
	"github.com/google/nftables/expr"
	"github.com/snapflowio/microvm-go/types"
	"golang.org/x/sys/unix"
)

const (
	CounterPacketsLimited       = "packets_limited"
	CounterNewConnectionLimited = "new_connection_limited"
	CounterDestinationLimited   = "destination_limited"
	CounterConnectionCapped     = "connection_capped"
	CounterUDPLimited           = "udp_limited"
	CounterICMPLimited          = "icmp_limited"
	CounterSMTPBlocked          = "smtp_blocked"
	CounterDoTBlocked           = "dot_blocked"
	CounterPoolBlocked          = "pool_blocked"
	CounterReflectionBlocked    = "reflection_blocked"
	CounterBruteForce           = "brute_force"
	CounterTCPAttempts          = "tcp_attempts"
	CounterTCPRefused           = "tcp_refused"

	SetRecentEndpoints = "recent_endpoints"
	SetMiningFlows     = "mining_flows"
	setMiningPorts     = "mining_ports"
	setPoolAddresses   = "pool_addresses"
	setDestinationRate = "destination_rate"
	setConnectionCount = "connection_count"
	setSensitiveRate   = "sensitive_rate"

	RecentEndpointsCapacity = 16384
	recentEndpointsTimeout  = time.Minute
	meterCapacity           = 65535
	destinationMeterTimeout = 2 * time.Minute
	sensitiveMeterTimeout   = time.Minute
	miningFlowsTimeout      = 5 * time.Minute
	miningFlowsCapacity     = 1024

	newConnectionBurstFactor = 10
	destinationRate          = 20
	destinationBurst         = 100
	udpFlowRate              = 200
	udpFlowBurst             = 400
	icmpRate                 = 10
	icmpBurst                = 50
	bruteForceRatePerMinute  = 20
	bruteForceBurst          = 20

	StratumMarkInspected = uint32(1)
	StratumMarkMatched   = uint32(2)
	inspectionMinimumLen = 80
	httpPort             = 80
	httpsPort            = 443
	dotPort              = 853
	tcpFlagsOffset       = 13
	tcpFlagReset         = 0x04
	icmpTypeOffset       = 0
	icmpDestUnreachable  = 3
	concatPortRegister   = 9
	concatThirdRegister  = 10
	natPortRegister      = 2

	SetConnectionRecords = "connection_records"
)

type Limits struct {
	Enforce                 bool
	PacketsPerSecond        uint32
	NewConnectionsPerSecond uint32
	MaxConnections          uint32
}

func SandboxCounters() []string {
	return append(Counters(),
		CounterNewConnectionLimited, CounterDestinationLimited, CounterConnectionCapped,
		CounterUDPLimited, CounterICMPLimited, CounterSMTPBlocked, CounterDoTBlocked,
		CounterPoolBlocked, CounterReflectionBlocked, CounterBruteForce,
		CounterTCPAttempts, CounterTCPRefused,
	)
}

func (limits Limits) action(counter string) []expr.Any {
	if limits.Enforce {
		return []expr.Any{countInto(counter), drop()}
	}
	return []expr.Any{countInto(counter)}
}

func addGuardSets(batch *rulesetBatch, table *nftables.Table, pool []nftables.SetElement) {
	endpoints := nftables.MustConcatSetType(nftables.TypeIPAddr, nftables.TypeInetService)
	batch.addSet(&nftables.Set{
		Table: table, Name: SetRecentEndpoints, KeyType: endpoints, Concatenation: true,
		Dynamic: true, HasTimeout: true, Timeout: recentEndpointsTimeout, Size: RecentEndpointsCapacity,
	}, nil)
	batch.addSet(&nftables.Set{
		Table: table, Name: setSensitiveRate, KeyType: endpoints, Concatenation: true,
		Dynamic: true, HasTimeout: true, Timeout: sensitiveMeterTimeout, Size: meterCapacity,
	}, nil)
	batch.addSet(&nftables.Set{
		Table: table, Name: setDestinationRate, KeyType: nftables.TypeIPAddr,
		Dynamic: true, HasTimeout: true, Timeout: destinationMeterTimeout, Size: meterCapacity,
	}, nil)
	batch.addSet(&nftables.Set{
		Table: table, Name: setConnectionCount, KeyType: nftables.TypeIFName, Dynamic: true, Size: meterCapacity,
	}, nil)
	batch.addSet(&nftables.Set{
		Table: table, Name: SetMiningFlows, KeyType: endpoints, Concatenation: true,
		Dynamic: true, HasTimeout: true, Timeout: miningFlowsTimeout, Size: miningFlowsCapacity,
	}, nil)
	batch.addSet(&nftables.Set{
		Table: table, Name: SetConnectionRecords,
		KeyType:       nftables.MustConcatSetType(nftables.TypeInetProto, nftables.TypeIPAddr, nftables.TypeInetService),
		Concatenation: true, Dynamic: true, HasTimeout: true,
		Timeout: types.ConnectionRecordWindow, Size: types.ConnectionRecordCapacity,
	}, nil)
	miningPortSet := batch.addSet(&nftables.Set{Table: table, Name: setMiningPorts, KeyType: nftables.TypeInetService}, nil)
	batch.replaceSetElements(miningPortSet, portElements(miningPorts()))
	poolSet := batch.addSet(&nftables.Set{Table: table, Name: setPoolAddresses, KeyType: nftables.TypeIPAddr}, nil)
	batch.replaceSetElements(poolSet, pool)
}

func portElements(ports []uint16) []nftables.SetElement {
	elements := make([]nftables.SetElement, 0, len(ports))
	for _, port := range ports {
		elements = append(elements, nftables.SetElement{Key: uint16Bytes(port)})
	}
	return elements
}

func addTrackingRules(batch *rulesetBatch, table *nftables.Table, chain *nftables.Chain, sandbox Sandbox) {
	fresh := newConnectionMatch()
	batch.addRule(rule(table, chain, protocolMatch(unix.IPPROTO_TCP), fresh, verdict(countInto(CounterTCPAttempts))))
	for _, protocol := range recordedProtocols() {
		batch.addRule(rule(table, chain, protocolMatch(protocol), fresh, endpointKey(), []expr.Any{
			&expr.Dynset{SrcRegKey: matchRegister, SetName: SetRecentEndpoints, Operation: unix.NFT_DYNSET_OP_ADD},
		}))
		batch.addRule(rule(table, chain, protocolMatch(protocol), fresh, connectionRecordKey(), recordConnection()))
	}
	for _, port := range sensitivePorts() {
		batch.addRule(rule(table, chain, portMatch(unix.IPPROTO_TCP, singlePort(port)), fresh, endpointKey(), []expr.Any{
			&expr.Dynset{
				SrcRegKey: matchRegister, SetName: setSensitiveRate, Operation: unix.NFT_DYNSET_OP_ADD,
				Exprs: []expr.Any{rateOver(bruteForceRatePerMinute, expr.LimitTimeMinute, bruteForceBurst)},
			},
			countInto(CounterBruteForce),
		}))
	}
	addLimitRules(batch, table, chain, sandbox.Limits)
}

func addLimitRules(batch *rulesetBatch, table *nftables.Table, chain *nftables.Chain, limits Limits) {
	fresh := newConnectionMatch()
	if limits.MaxConnections > 0 {
		batch.addRule(rule(table, chain, fresh,
			[]expr.Any{
				&expr.Meta{Key: expr.MetaKeyIIFNAME, Register: matchRegister},
				&expr.Dynset{
					SrcRegKey: matchRegister, SetName: setConnectionCount, Operation: unix.NFT_DYNSET_OP_ADD,
					Exprs: []expr.Any{&expr.Connlimit{Count: limits.MaxConnections, Flags: expr.NFT_CONNLIMIT_F_INV}},
				},
			},
			limits.action(CounterConnectionCapped)))
	}
	if limits.NewConnectionsPerSecond > 0 {
		rate := uint64(limits.NewConnectionsPerSecond)
		batch.addRule(rule(table, chain, fresh,
			verdict(rateOver(rate, expr.LimitTimeSecond, uint32(rate*newConnectionBurstFactor))),
			limits.action(CounterNewConnectionLimited)))
	}
	batch.addRule(rule(table, chain, fresh,
		[]expr.Any{
			&expr.Payload{DestRegister: matchRegister, Base: expr.PayloadBaseNetworkHeader, Offset: ipv4DestinationOffset, Len: ipv4AddressBytes},
			&expr.Dynset{
				SrcRegKey: matchRegister, SetName: setDestinationRate, Operation: unix.NFT_DYNSET_OP_UPDATE,
				Exprs: []expr.Any{rateOver(destinationRate, expr.LimitTimeSecond, destinationBurst)},
			},
		},
		limits.action(CounterDestinationLimited)))
	batch.addRule(rule(table, chain, protocolMatch(unix.IPPROTO_UDP), fresh,
		verdict(rateOver(udpFlowRate, expr.LimitTimeSecond, udpFlowBurst)), limits.action(CounterUDPLimited)))
	batch.addRule(rule(table, chain, protocolMatch(unix.IPPROTO_ICMP),
		verdict(rateOver(icmpRate, expr.LimitTimeSecond, icmpBurst)), limits.action(CounterICMPLimited)))
}

func addPacketLimit(batch *rulesetBatch, table *nftables.Table, chain *nftables.Chain, limits Limits) {
	batch.addObject(&nftables.CounterObj{Table: table, Name: CounterPacketsLimited})
	if limits.PacketsPerSecond == 0 {
		return
	}
	batch.addRule(rule(table, chain,
		verdict(rateOver(uint64(limits.PacketsPerSecond), expr.LimitTimeSecond, limits.PacketsPerSecond)),
		limits.action(CounterPacketsLimited)))
}

func addBlockRules(batch *rulesetBatch, table *nftables.Table, chain *nftables.Chain) {
	batch.addRule(rule(table, chain,
		[]expr.Any{
			&expr.Payload{DestRegister: matchRegister, Base: expr.PayloadBaseNetworkHeader, Offset: ipv4DestinationOffset, Len: ipv4AddressBytes},
			setLookup(matchRegister, setPoolAddresses),
		},
		[]expr.Any{countInto(CounterPoolBlocked), drop()}))
	for _, port := range mailPorts() {
		batch.addRule(rule(table, chain, portMatch(unix.IPPROTO_TCP, singlePort(port)),
			[]expr.Any{countInto(CounterSMTPBlocked), rejectTCP()}))
	}
	for _, protocol := range []byte{unix.IPPROTO_TCP, unix.IPPROTO_UDP} {
		batch.addRule(rule(table, chain, portMatch(protocol, singlePort(dotPort)),
			[]expr.Any{countInto(CounterDoTBlocked), drop()}))
	}
}

func addEstablishedEgress(batch *rulesetBatch, table *nftables.Table, chain *nftables.Chain, sandbox Sandbox) {
	fromGuest := interfaceMatch(expr.MetaKeyIIFNAME, sandbox.TAP, expr.CmpOpEq)
	established := establishedMatch()
	batch.addRule(rule(table, chain, fromGuest, protocolMatch(unix.IPPROTO_TCP),
		[]expr.Any{
			&expr.Payload{DestRegister: matchRegister, Base: expr.PayloadBaseTransportHeader, Offset: transportPortOffset, Len: transportPortBytes},
			setLookup(matchRegister, setMiningPorts),
		},
		endpointKey(),
		[]expr.Any{&expr.Dynset{SrcRegKey: matchRegister, SetName: SetMiningFlows, Operation: unix.NFT_DYNSET_OP_UPDATE}}))
	batch.addRule(rule(table, chain, fromGuest, established, ctMarkMatch(StratumMarkMatched, expr.CmpOpNeq), verdict(drop())))
	for _, protocol := range recordedProtocols() {
		batch.addRule(rule(table, chain, fromGuest, established, protocolMatch(protocol), connectionRecordKey(), recordConnection()))
	}
	batch.addRule(rule(table, chain, fromGuest, established, verdict(countInto(CounterInternetEgress))))
	if sandbox.StratumQueue != nil {
		batch.addRule(rule(table, chain, fromGuest, established,
			protocolMatch(unix.IPPROTO_TCP), destinationPortExcluded(httpPort, httpsPort),
			ctMarkMatch(StratumMarkInspected, expr.CmpOpEq), packetLengthAbove(inspectionMinimumLen),
			verdict(&expr.Queue{Num: *sandbox.StratumQueue, Flag: expr.QueueFlagBypass})))
	}
	batch.addRule(rule(table, chain, fromGuest, established, verdict(accept())))
	toGuest := interfaceMatch(expr.MetaKeyOIFNAME, sandbox.TAP, expr.CmpOpEq)
	batch.addRule(rule(table, chain, toGuest, protocolMatch(unix.IPPROTO_TCP),
		transportByteMatch(tcpFlagsOffset, tcpFlagReset, expr.CmpOpNeq, 0), verdict(countInto(CounterTCPRefused))))
	batch.addRule(rule(table, chain, toGuest, protocolMatch(unix.IPPROTO_ICMP),
		transportByteMatch(icmpTypeOffset, fullByteMask, expr.CmpOpEq, icmpDestUnreachable), verdict(countInto(CounterTCPRefused))))
	batch.addRule(rule(table, chain, toGuest, established, verdict(countInto(CounterInternetIngress)), verdict(accept())))
}

func addResolverRules(batch *rulesetBatch, table *nftables.Table, forward, prerouting *nftables.Chain, sandbox Sandbox) {
	if sandbox.ResolverPort == 0 {
		return
	}
	hostTransit := sandbox.HostTransit.As4()
	for _, protocol := range []byte{unix.IPPROTO_TCP, unix.IPPROTO_UDP} {
		batch.addRule(rule(table, prerouting,
			interfaceMatch(expr.MetaKeyIIFNAME, sandbox.TAP, expr.CmpOpEq),
			portMatch(protocol, singlePort(dnsPort)),
			[]expr.Any{
				&expr.Immediate{Register: natRegisterAddress, Data: hostTransit[:]},
				&expr.Immediate{Register: natPortRegister, Data: uint16Bytes(sandbox.ResolverPort)},
				&expr.NAT{
					Type: expr.NATTypeDestNAT, Family: unix.NFPROTO_IPV4,
					RegAddrMin: natRegisterAddress, RegProtoMin: natPortRegister,
				},
			}))
		batch.addRule(rule(table, forward,
			addressMatch(ipv4DestinationOffset, hostPrefix(sandbox.HostTransit), expr.CmpOpEq),
			portMatch(protocol, singlePort(sandbox.ResolverPort)), verdict(accept())))
	}
}

func recordedProtocols() []byte {
	return []byte{unix.IPPROTO_TCP, unix.IPPROTO_UDP}
}

func recordConnection() []expr.Any {
	return []expr.Any{&expr.Dynset{
		SrcRegKey: matchRegister, SetName: SetConnectionRecords,
		Operation: unix.NFT_DYNSET_OP_UPDATE, Timeout: types.ConnectionRecordWindow,
	}}
}

func connectionRecordKey() []expr.Any {
	return []expr.Any{
		&expr.Meta{Key: expr.MetaKeyL4PROTO, Register: matchRegister},
		&expr.Payload{DestRegister: concatPortRegister, Base: expr.PayloadBaseNetworkHeader, Offset: ipv4DestinationOffset, Len: ipv4AddressBytes},
		&expr.Payload{DestRegister: concatThirdRegister, Base: expr.PayloadBaseTransportHeader, Offset: transportPortOffset, Len: transportPortBytes},
	}
}

func endpointKey() []expr.Any {
	return []expr.Any{
		&expr.Payload{DestRegister: matchRegister, Base: expr.PayloadBaseNetworkHeader, Offset: ipv4DestinationOffset, Len: ipv4AddressBytes},
		&expr.Payload{DestRegister: concatPortRegister, Base: expr.PayloadBaseTransportHeader, Offset: transportPortOffset, Len: transportPortBytes},
	}
}
