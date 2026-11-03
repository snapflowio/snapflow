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
	"encoding/binary"
	"net"
	"net/netip"

	"github.com/google/nftables"
	"github.com/google/nftables/binaryutil"
	"github.com/google/nftables/expr"
	"golang.org/x/sys/unix"
)

const (
	interfaceNameBytes    = 16
	ipv4SourceOffset      = 12
	ipv4DestinationOffset = 16
	ipv4AddressBytes      = 4
	transportPortOffset   = 2
	transportPortBytes    = 2
	etherSourceOffset     = 6
	etherAddressBytes     = 6
	etherTypeOffset       = 12
	etherTypeBytes        = 2
	etherTypeIPv4         = 0x0800
	etherTypeARP          = 0x0806
	arpSenderMACOffset    = 8
	arpSenderIPOffset     = 14
	ctStateBytes          = 4
	bitsPerByte           = 8
	fullByteMask          = 0xff
	matchRegister         = 1
)

type portRange struct {
	first uint16
	last  uint16
}

func singlePort(port uint16) portRange {
	return portRange{first: port, last: port}
}

func accept() expr.Any { return &expr.Verdict{Kind: expr.VerdictAccept} }

func drop() expr.Any { return &expr.Verdict{Kind: expr.VerdictDrop} }

func countInto(counter string) expr.Any {
	return &expr.Objref{Type: int(nftables.ObjTypeCounter), Name: counter}
}

func interfaceMatch(key expr.MetaKey, name string, operation expr.CmpOp) []expr.Any {
	encoded := make([]byte, interfaceNameBytes)
	copy(encoded, name)
	return []expr.Any{
		&expr.Meta{Key: key, Register: matchRegister},
		&expr.Cmp{Op: operation, Register: matchRegister, Data: encoded},
	}
}

// interfacePrefixMatch matches every interface whose name starts with prefix,
// like iifname "sfh*".
func interfacePrefixMatch(key expr.MetaKey, prefix string) []expr.Any {
	return interfacePrefixCompare(key, prefix, expr.CmpOpEq)
}

func interfacePrefixCompare(key expr.MetaKey, prefix string, operation expr.CmpOp) []expr.Any {
	return []expr.Any{
		&expr.Meta{Key: key, Register: matchRegister},
		&expr.Cmp{Op: operation, Register: matchRegister, Data: []byte(prefix)},
	}
}

func addressMatch(offset uint32, prefix netip.Prefix, operation expr.CmpOp) []expr.Any {
	address := prefix.Masked().Addr().As4()
	expressions := []expr.Any{&expr.Payload{
		DestRegister: matchRegister,
		Base:         expr.PayloadBaseNetworkHeader,
		Offset:       offset,
		Len:          ipv4AddressBytes,
	}}
	if prefix.Bits() < prefix.Addr().BitLen() {
		expressions = append(expressions, &expr.Bitwise{
			SourceRegister: matchRegister,
			DestRegister:   matchRegister,
			Len:            ipv4AddressBytes,
			Mask:           prefixMask(prefix.Bits()),
			Xor:            make([]byte, ipv4AddressBytes),
		})
	}
	return append(expressions, &expr.Cmp{Op: operation, Register: matchRegister, Data: address[:]})
}

func hostPrefix(address netip.Addr) netip.Prefix {
	return netip.PrefixFrom(address, address.BitLen())
}

func linkLayerMatch(offset, length uint32, value []byte) []expr.Any {
	return []expr.Any{
		&expr.Payload{DestRegister: matchRegister, Base: expr.PayloadBaseLLHeader, Offset: offset, Len: length},
		&expr.Cmp{Op: expr.CmpOpEq, Register: matchRegister, Data: value},
	}
}

func etherSourceMatch(address net.HardwareAddr) []expr.Any {
	return linkLayerMatch(etherSourceOffset, etherAddressBytes, address)
}

func etherTypeMatch(etherType uint16) []expr.Any {
	return linkLayerMatch(etherTypeOffset, etherTypeBytes, binaryutil.BigEndian.PutUint16(etherType))
}

func networkHeaderMatch(offset, length uint32, value []byte) []expr.Any {
	return []expr.Any{
		&expr.Payload{DestRegister: matchRegister, Base: expr.PayloadBaseNetworkHeader, Offset: offset, Len: length},
		&expr.Cmp{Op: expr.CmpOpEq, Register: matchRegister, Data: value},
	}
}

func portMatch(protocol byte, port portRange) []expr.Any {
	expressions := []expr.Any{
		&expr.Meta{Key: expr.MetaKeyL4PROTO, Register: matchRegister},
		&expr.Cmp{Op: expr.CmpOpEq, Register: matchRegister, Data: []byte{protocol}},
		&expr.Payload{DestRegister: matchRegister, Base: expr.PayloadBaseTransportHeader, Offset: transportPortOffset, Len: transportPortBytes},
	}
	if port.first == port.last {
		return append(expressions, &expr.Cmp{Op: expr.CmpOpEq, Register: matchRegister, Data: uint16Bytes(port.first)})
	}
	return append(expressions, &expr.Range{
		Op:       expr.CmpOpEq,
		Register: matchRegister,
		FromData: uint16Bytes(port.first),
		ToData:   uint16Bytes(port.last),
	})
}

func establishedMatch() []expr.Any {
	stateMask := expr.CtStateBitESTABLISHED | expr.CtStateBitRELATED
	return []expr.Any{
		&expr.Ct{Register: matchRegister, Key: expr.CtKeySTATE},
		&expr.Bitwise{
			SourceRegister: matchRegister,
			DestRegister:   matchRegister,
			Len:            ctStateBytes,
			Mask:           binaryutil.NativeEndian.PutUint32(stateMask),
			Xor:            binaryutil.NativeEndian.PutUint32(0),
		},
		&expr.Cmp{Op: expr.CmpOpNeq, Register: matchRegister, Data: make([]byte, ctStateBytes)},
	}
}

func rejectTCP() expr.Any { return &expr.Reject{Type: unix.NFT_REJECT_TCP_RST} }

func prefixMask(bits int) []byte {
	mask := make([]byte, ipv4AddressBytes)
	for index := range mask {
		remaining := bits - index*bitsPerByte
		switch {
		case remaining >= bitsPerByte:
			mask[index] = fullByteMask
		case remaining > 0:
			mask[index] = byte(fullByteMask << (bitsPerByte - remaining))
		}
	}
	return mask
}

func uint16Bytes(value uint16) []byte {
	encoded := make([]byte, transportPortBytes)
	binary.BigEndian.PutUint16(encoded, value)
	return encoded
}

func rule(table *nftables.Table, chain *nftables.Chain, parts ...[]expr.Any) *nftables.Rule {
	var expressions []expr.Any
	for _, part := range parts {
		expressions = append(expressions, part...)
	}
	return &nftables.Rule{Table: table, Chain: chain, Exprs: expressions}
}

func verdict(expression expr.Any) []expr.Any { return []expr.Any{expression} }
