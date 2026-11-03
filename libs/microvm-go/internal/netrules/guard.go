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
	smtpPort         = 25
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
)

// blockedTCPPorts stop mail spam and Windows file-sharing scans; SMTP gets a
// reset so clients fail fast instead of timing out.
func blockedTCPPorts() []portRange {
	return []portRange{
		singlePort(smtpPort),
		singlePort(msrpcPort),
		{first: netbiosFirstPort, last: netbiosLastPort},
		singlePort(smbPort),
	}
}

// blockedUDPPorts are the protocols used for reflection and amplification
// attacks. DNS is allowed only to the configured resolver, which is exempt.
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
