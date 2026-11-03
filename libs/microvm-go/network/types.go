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

type Config struct {
	Enabled bool
	// DNS is the resolver guests use; it is exempt from the UDP 53 guard.
	DNS string
	// Transit is the range carved into one point-to-point /31 per sandbox
	// between its namespace and the host.
	Transit string
	// HostServicePorts are host TCP ports guests reach at their gateway.
	// Development uses this for the local registry; production sets none.
	HostServicePorts []uint16
}

// Allocation is one sandbox's network: its namespace, the veth pair to the
// host, and the guest addressing, which is identical in every sandbox.
type Allocation struct {
	Slot           int
	Namespace      string
	HostVeth       string
	TransitHost    string
	TransitSandbox string
	TAPDevice      string
	IP             string
	MAC            string
	Gateway        string
	Netmask        string
	DNS            string
}

type MeterReading struct {
	InternetEgressBytes  uint64
	InternetIngressBytes uint64
	HostEgressBytes      uint64
	HostIngressBytes     uint64
	TapEgressBytes       uint64
	TapIngressBytes      uint64
	Available            bool
}

func DefaultConfig() Config {
	return Config{Enabled: true, DNS: defaultResolver, Transit: defaultTransit}
}

func (config Config) Normalized() Config {
	if config.Transit == "" {
		config.Transit = defaultTransit
	}
	if config.DNS == "" {
		config.DNS = defaultResolver
	}
	return config
}
