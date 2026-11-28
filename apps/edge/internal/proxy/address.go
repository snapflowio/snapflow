// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package proxy

import (
	"net"
	"net/netip"
)

const unzoned = ""

func SourceAddress(address net.Addr) (netip.AddrPort, bool) {
	switch value := address.(type) {
	case *net.TCPAddr:
		return unmapped(value.AddrPort())
	case *net.UDPAddr:
		return unmapped(value.AddrPort())
	default:
		parsed, err := netip.ParseAddrPort(address.String())
		return parsed, err == nil
	}
}

func unmapped(address netip.AddrPort) (netip.AddrPort, bool) {
	ip := address.Addr()
	return netip.AddrPortFrom(ip.Unmap().WithZone(unzoned), address.Port()), ip.IsValid()
}

func ProxyDestination(
	address net.Addr,
	sourceFamily netip.Addr,
) (netip.AddrPort, bool) {
	destination, valid := SourceAddress(address)
	if !valid {
		return netip.AddrPort{}, false
	}
	if destination.Addr().IsUnspecified() {
		if sourceFamily.Is4() {
			destination = netip.AddrPortFrom(netip.IPv4Unspecified(), destination.Port())
		} else {
			destination = netip.AddrPortFrom(netip.IPv6Unspecified(), destination.Port())
		}
	}
	return destination, true
}
