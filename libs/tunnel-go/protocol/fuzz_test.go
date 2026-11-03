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

package protocol

import (
	"bytes"
	"net/netip"
	"testing"

	"github.com/google/uuid"
)

func FuzzReadControlFrame(f *testing.F) {
	valid := StreamOpen{
		Version:              Version,
		BackendID:            uuid.MustParse("018f6d8f-b0cc-7a91-86f5-f9156e476270"),
		AssignmentGeneration: 1,
		ConnectionID:         uuid.MustParse("018f6d8f-b0cc-7a91-86f5-f9156e476271"),
		Protocol:             ProtocolHTTP,
		Source:               netip.MustParseAddrPort("203.0.113.10:443"),
	}
	var frame bytes.Buffer
	if err := WriteFrame(&frame, valid); err != nil {
		f.Fatalf("seed control frame: %v", err)
	}
	f.Add(frame.Bytes())
	f.Add([]byte{0, 0, 0, 0})
	f.Add([]byte{0, 1, 0, 0})

	f.Fuzz(func(t *testing.T, data []byte) {
		var decoded StreamOpen
		if err := ReadFrame(bytes.NewReader(data), &decoded); err != nil {
			return
		}
		if err := decoded.Validate(); err != nil {
			return
		}
		var encoded bytes.Buffer
		if err := WriteFrame(&encoded, decoded); err != nil {
			t.Fatalf("encode accepted control frame: %v", err)
		}
	})
}

func FuzzParseDatagram(f *testing.F) {
	datagram := Datagram{
		Direction:            DatagramToMachine,
		BackendID:            uuid.MustParse("018f6d8f-b0cc-7a91-86f5-f9156e476270"),
		AssignmentGeneration: 1,
		FlowID:               1,
		DatagramID:           1,
		TotalLength:          4,
		Payload:              []byte("seed"),
	}
	valid, err := datagram.MarshalBinary()
	if err != nil {
		f.Fatalf("seed datagram frame: %v", err)
	}
	f.Add(valid)
	f.Add([]byte{Version, byte(DatagramToMachine)})
	f.Add(make([]byte, datagramHeaderBytes))

	f.Fuzz(func(t *testing.T, data []byte) {
		decoded, err := ParseDatagram(data)
		if err != nil {
			return
		}
		if err := decoded.Validate(); err != nil {
			t.Fatalf("parsed datagram is invalid: %v", err)
		}
		encoded, err := decoded.MarshalBinary()
		if err != nil {
			t.Fatalf("encode accepted datagram: %v", err)
		}
		reparsed, err := ParseDatagram(encoded)
		if err != nil {
			t.Fatalf("parse encoded datagram: %v", err)
		}
		if err := reparsed.Validate(); err != nil {
			t.Fatalf("reparsed datagram is invalid: %v", err)
		}
	})
}
