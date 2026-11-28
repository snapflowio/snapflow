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
	"fmt"
	"net/netip"

	"github.com/google/nftables"
	"github.com/snapflowio/microvm-go/types"
	"golang.org/x/sys/unix"
)

const (
	endpointKeyBytes         = 8
	concatFieldBytes         = 4
	connectionRecordKeyBytes = 3 * concatFieldBytes
)

type Endpoint struct {
	Address netip.Addr
	Port    uint16
}

func ReadEndpoints(namespaceFd int, setName string) ([]Endpoint, error) {
	keys, err := readSetKeys(namespaceFd, setName)
	if err != nil {
		return nil, err
	}
	endpoints := make([]Endpoint, 0, len(keys))
	for _, key := range keys {
		if len(key) < endpointKeyBytes {
			continue
		}
		endpoints = append(endpoints, Endpoint{
			Address: netip.AddrFrom4([ipv4AddressBytes]byte(key[:ipv4AddressBytes])),
			Port:    binary.BigEndian.Uint16(key[ipv4AddressBytes : ipv4AddressBytes+transportPortBytes]),
		})
	}
	return endpoints, nil
}

func ReadConnectionRecords(namespaceFd int) ([]types.ConnectionRecord, error) {
	keys, err := readSetKeys(namespaceFd, SetConnectionRecords)
	if err != nil {
		return nil, err
	}
	records := make([]types.ConnectionRecord, 0, len(keys))
	for _, key := range keys {
		if len(key) < connectionRecordKeyBytes {
			continue
		}
		protocol, known := connectionProtocol(key[0])
		if !known {
			continue
		}
		address := key[concatFieldBytes : concatFieldBytes+ipv4AddressBytes]
		port := key[2*concatFieldBytes : 2*concatFieldBytes+transportPortBytes]
		records = append(records, types.ConnectionRecord{
			Protocol: protocol,
			Address:  netip.AddrFrom4([ipv4AddressBytes]byte(address)),
			Port:     binary.BigEndian.Uint16(port),
		})
	}
	return records, nil
}

func connectionProtocol(number byte) (types.ConnectionProtocol, bool) {
	switch number {
	case unix.IPPROTO_TCP:
		return types.ConnectionProtocolTCP, true
	case unix.IPPROTO_UDP:
		return types.ConnectionProtocolUDP, true
	default:
		return "", false
	}
}

func readSetKeys(namespaceFd int, setName string) ([][]byte, error) {
	batch, err := newRulesetBatch(namespaceFd)
	if err != nil {
		return nil, err
	}
	table := &nftables.Table{Name: sandboxTableName, Family: nftables.TableFamilyIPv4}
	set, err := batch.connection.GetSetByName(table, setName)
	if err != nil {
		return nil, fmt.Errorf("find set %s: %w", setName, err)
	}
	elements, err := batch.connection.GetSetElements(set)
	if err != nil {
		return nil, fmt.Errorf("read set %s: %w", setName, err)
	}
	keys := make([][]byte, 0, len(elements))
	for _, element := range elements {
		keys = append(keys, element.Key)
	}
	return keys, nil
}
