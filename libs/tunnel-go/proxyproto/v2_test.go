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
	"bytes"
	"net/netip"
	"testing"
)

func TestEncodeV2SupportsStreamAndDatagramFamilies(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name        string
		source      string
		destination string
		transport   Transport
		family      byte
		length      int
	}{
		{"tcp4", "192.0.2.10:43120", "198.51.100.4:27015", TransportStream, 0x11, 28},
		{"udp4", "192.0.2.10:43120", "198.51.100.4:27015", TransportDatagram, 0x12, 28},
		{"tcp6", "[2001:db8::10]:43120", "[2001:db8::20]:27015", TransportStream, 0x21, 52},
		{"udp6", "[2001:db8::10]:43120", "[2001:db8::20]:27015", TransportDatagram, 0x22, 52},
	}
	for index := range cases {
		testCase := cases[index]
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()
			header, err := EncodeV2(
				netip.MustParseAddrPort(testCase.source),
				netip.MustParseAddrPort(testCase.destination),
				testCase.transport,
			)
			if err != nil {
				t.Fatal(err)
			}
			if len(header) != testCase.length || header[13] != testCase.family {
				t.Fatalf("header length/family = %d/%x", len(header), header[13])
			}
			if !bytes.Equal(header[:len(v2Signature)], []byte(v2Signature)) {
				t.Fatalf("invalid PROXY v2 signature: %x", header[:12])
			}
		})
	}
}

func TestEncodeV2RejectsMixedAddressFamilies(t *testing.T) {
	t.Parallel()
	header, err := EncodeV2(
		netip.MustParseAddrPort("192.0.2.1:1000"),
		netip.MustParseAddrPort("[2001:db8::1]:1000"),
		TransportStream,
	)
	if err == nil || header != nil {
		t.Fatal("mixed address families were accepted")
	}
}
