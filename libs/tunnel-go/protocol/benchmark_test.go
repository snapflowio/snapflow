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
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
)

func BenchmarkDatagramCodecAndReassembly(b *testing.B) {
	for _, payloadBytes := range []int{
		128,
		512,
		1_024,
		8_192,
		32_768,
		MaxUDPApplicationPayloadBytes,
	} {
		b.Run(fmt.Sprintf("%d-bytes", payloadBytes), func(b *testing.B) {
			payload := bytes.Repeat([]byte{0x5a}, payloadBytes)
			backendID := uuid.MustParse("00000000-0000-4000-8000-000000000001")
			reassembler, err := NewReassembler(DefaultReassemblerConfig())
			if err != nil {
				b.Fatalf("create reassembler: %v", err)
			}
			b.ReportAllocs()
			b.SetBytes(int64(payloadBytes))
			b.ResetTimer()
			for iteration := 0; iteration < b.N; iteration++ {
				fragments, err := FragmentDatagram(
					DatagramToMachine,
					backendID,
					1,
					1,
					uint32(iteration)+1,
					payload,
					1_100,
				)
				if err != nil {
					b.Fatalf("fragment datagram: %v", err)
				}
				var assembled []byte
				for _, fragment := range fragments {
					frame, err := fragment.MarshalBinary()
					if err != nil {
						b.Fatalf("marshal fragment: %v", err)
					}
					parsed, err := ParseDatagram(frame)
					if err != nil {
						b.Fatalf("parse fragment: %v", err)
					}
					result, complete, err := reassembler.Add(parsed, time.Time{})
					if err != nil {
						b.Fatalf("reassemble fragment: %v", err)
					}
					if complete {
						assembled = result
					}
				}
				if len(assembled) != payloadBytes {
					b.Fatalf(
						"assembled payload is %d bytes, want %d",
						len(assembled),
						payloadBytes,
					)
				}
			}
		})
	}
}
