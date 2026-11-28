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

package types

import (
	"net/netip"
	"time"
)

type GuardCounters struct {
	PacketsLimited       uint64
	NewConnectionLimited uint64
	DestinationLimited   uint64
	ConnectionCapped     uint64
	UDPLimited           uint64
	ICMPLimited          uint64
	SMTPBlocked          uint64
	DoTBlocked           uint64
	PoolBlocked          uint64
	ReflectionBlocked    uint64
	BruteForce           uint64
	TCPAttempts          uint64
	TCPRefused           uint64
}

type EndpointSummary struct {
	Endpoints              int
	Destinations           int
	NonWebDestinations     int
	MaxPortsPerDestination int
	MiningPortFlows        int
	Saturated              bool
}

const (
	ConnectionRecordWindow   = 2 * time.Minute
	ConnectionRecordCapacity = 65535
)

type ConnectionProtocol string

const (
	ConnectionProtocolTCP ConnectionProtocol = "tcp"
	ConnectionProtocolUDP ConnectionProtocol = "udp"
)

type ConnectionRecord struct {
	Protocol ConnectionProtocol
	Address  netip.Addr
	Port     uint16
}

type ReleasedConnections struct {
	InstanceID  string
	BuildTenant string
	ReleasedAt  time.Time
	Connections []ConnectionRecord
	Complete    bool
}

type ReleasedConnectionBatch struct {
	Readings []ReleasedConnections
	Complete bool
}

type GuardReading struct {
	Counters    GuardCounters
	Endpoints   EndpointSummary
	Resolver    ResolverReading
	StratumHits uint64
	Connections []ConnectionRecord
	Available   bool
}

type ResolverReading struct {
	BlockedQueries  uint64
	DistinctDomains int
}
