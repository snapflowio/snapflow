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

const (
	ftpPort          = 21
	sshPort          = 22
	telnetPort       = 23
	smtpPort         = 25
	smtpsPort        = 465
	submissionPort   = 587
	altSMTPPort      = 2525
	mysqlPort        = 3306
	rdpPort          = 3389
	postgresPort     = 5432
	vncPort          = 5900
	redisPort        = 6379
	mongoPort        = 27017
	msrpcPort        = 135
	netbiosFirstPort = 137
	netbiosLastPort  = 139
	smbPort          = 445
	chargenPort      = 19
	dnsPort          = 53
	rpcbindPort      = 111
	ntpPort          = 123
	snmpPort         = 161
	ldapPort         = 389
	ssdpPort         = 1900
	wsDiscoveryPort  = 3702
	memcachedPort    = 11211
	stratumPort      = 3333
	stratumAltFirst  = 3334
	stratumAltLast   = 3336
	stratumNiceHash  = 3357
	minerProxyPort   = 4444
	minerPoolFirst   = 5555
	minerPoolLast    = 5556
	minerEthFirst    = 7777
	minerEthLast     = 7778
	minerLegacyPort  = 9999
	minerTLSPort     = 14433
	minerMoneroPort  = 14444
	minerKawpowPort  = 45560
	minerRavenPort   = 45700
)

func miningPorts() []uint16 {
	ports := []uint16{stratumPort, stratumNiceHash, minerProxyPort, minerLegacyPort, minerTLSPort, minerMoneroPort, minerKawpowPort, minerRavenPort}
	for _, span := range []portRange{
		{first: stratumAltFirst, last: stratumAltLast},
		{first: minerPoolFirst, last: minerPoolLast},
		{first: minerEthFirst, last: minerEthLast},
	} {
		for port := span.first; port <= span.last; port++ {
			ports = append(ports, port)
		}
	}
	return ports
}

func blockedTCPPorts() []portRange {
	return []portRange{
		singlePort(msrpcPort),
		{first: netbiosFirstPort, last: netbiosLastPort},
		singlePort(smbPort),
	}
}

func blockedUDPPorts() []portRange {
	return []portRange{
		singlePort(chargenPort),
		singlePort(dnsPort),
		singlePort(rpcbindPort),
		singlePort(ntpPort),
		{first: netbiosFirstPort, last: netbiosLastPort},
		singlePort(snmpPort),
		singlePort(ldapPort),
		singlePort(ssdpPort),
		singlePort(wsDiscoveryPort),
		singlePort(memcachedPort),
	}
}

func mailPorts() []uint16 { return []uint16{smtpPort, smtpsPort, submissionPort, altSMTPPort} }

func sensitivePorts() []uint16 {
	return []uint16{ftpPort, sshPort, telnetPort, smbPort, mysqlPort, rdpPort, postgresPort, vncPort, redisPort, mongoPort}
}
