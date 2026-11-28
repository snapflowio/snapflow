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

package proxyproto

import (
	"encoding/binary"
	"errors"
	"net/netip"
)

const (
	v2Signature         = "\r\n\r\n\x00\r\nQUIT\n"
	versionCommandProxy = 0x21
	familyStreamIPv4    = 0x11
	familyDatagramIPv4  = 0x12
	familyStreamIPv6    = 0x21
	familyDatagramIPv6  = 0x22
	fixedHeaderLength   = 16
	portLength          = 2
	endpointCount       = 2
)

type Transport uint8

const (
	TransportStream Transport = iota
	TransportDatagram
)

func EncodeV2(
	source netip.AddrPort,
	destination netip.AddrPort,
	transport Transport,
) ([]byte, error) {
	if !source.IsValid() || !destination.IsValid() {
		return nil, errors.New("PROXY v2 requires valid source and destination backends")
	}
	if transport != TransportStream && transport != TransportDatagram {
		return nil, errors.New("PROXY v2 transport is invalid")
	}
	source = netip.AddrPortFrom(source.Addr().Unmap(), source.Port())
	destination = netip.AddrPortFrom(destination.Addr().Unmap(), destination.Port())
	if source.Addr().Is4() != destination.Addr().Is4() {
		return nil, errors.New("PROXY v2 backend address families do not match")
	}
	sourceAddress := source.Addr().AsSlice()
	destinationAddress := destination.Addr().AsSlice()
	addressLength := endpointCount * (len(sourceAddress) + portLength)
	header := make([]byte, fixedHeaderLength, fixedHeaderLength+addressLength)
	copy(header, v2Signature)
	header[len(v2Signature)] = versionCommandProxy
	header[len(v2Signature)+1] = familyAndProtocol(source.Addr().Is4(), transport)
	binary.BigEndian.PutUint16(header[len(v2Signature)+2:], uint16(addressLength))
	header = append(header, sourceAddress...)
	header = append(header, destinationAddress...)
	header = binary.BigEndian.AppendUint16(header, source.Port())
	return binary.BigEndian.AppendUint16(header, destination.Port()), nil
}

func familyAndProtocol(ipv4 bool, transport Transport) byte {
	switch {
	case ipv4 && transport == TransportDatagram:
		return familyDatagramIPv4
	case ipv4:
		return familyStreamIPv4
	case transport == TransportDatagram:
		return familyDatagramIPv6
	default:
		return familyStreamIPv6
	}
}
