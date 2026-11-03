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
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestControlFrameRoundTrip(t *testing.T) {
	t.Parallel()
	expected := StreamOpen{
		Version: Version, BackendID: uuid.New(), AssignmentGeneration: 7,
		Binding:      bindingForTest(),
		ConnectionID: uuid.New(),
		Protocol:     ProtocolTCP,
		Source:       netip.MustParseAddrPort("203.0.113.10:4567"),
	}
	var buffer bytes.Buffer
	if err := WriteFrame(&buffer, expected); err != nil {
		t.Fatalf("write frame: %v", err)
	}
	var actual StreamOpen
	if err := ReadFrame(&buffer, &actual); err != nil {
		t.Fatalf("read frame: %v", err)
	}
	if actual != expected {
		t.Fatalf("frame mismatch: got %+v want %+v", actual, expected)
	}
}

func TestHeartbeatFrameRoundTrip(t *testing.T) {
	t.Parallel()
	expected := HeartbeatResponse{
		Version: Version, Sequence: 1, Binding: bindingForTest(),
	}
	var buffer bytes.Buffer
	if err := WriteFrame(&buffer, expected); err != nil {
		t.Fatalf("write heartbeat: %v", err)
	}
	var actual HeartbeatResponse
	if err := ReadFrame(&buffer, &actual); err != nil {
		t.Fatalf("read heartbeat: %v", err)
	}
	if err := actual.Validate(); err != nil {
		t.Fatalf("validate heartbeat: %v", err)
	}
	if actual != expected {
		t.Fatalf("heartbeat mismatch: got %+v want %+v", actual, expected)
	}
}

func bindingForTest() Binding {
	return Binding{
		ID: uuid.New(), Revision: 1, Digest: strings.Repeat("a", 64),
	}
}

func TestDatagramFragmentReassembly(t *testing.T) {
	t.Parallel()
	payload := bytes.Repeat([]byte{0x5a}, MaxUDPApplicationPayloadBytes)
	backendID := uuid.New()
	fragments, err := FragmentDatagram(
		DatagramToMachine, backendID, 3, 42, 1, payload, 1200,
	)
	if err != nil {
		t.Fatalf("fragment datagram: %v", err)
	}
	if len(fragments) < 2 {
		t.Fatal("expected fragmented datagram")
	}
	reassembler, err := NewReassembler(DefaultReassemblerConfig())
	if err != nil {
		t.Fatalf("create reassembler: %v", err)
	}
	now := time.Now()
	var result []byte
	for index := len(fragments) - 1; index >= 0; index-- {
		frame, err := fragments[index].MarshalBinary()
		if err != nil {
			t.Fatalf("marshal fragment: %v", err)
		}
		parsed, err := ParseDatagram(frame)
		if err != nil {
			t.Fatalf("parse fragment: %v", err)
		}
		assembled, complete, err := reassembler.Add(parsed, now)
		if err != nil {
			t.Fatalf("add fragment: %v", err)
		}
		if complete {
			result = assembled
		}
	}
	if !bytes.Equal(result, payload) {
		t.Fatal("reassembled payload does not match")
	}
}

func TestReassemblerPrunesIncompleteMessages(t *testing.T) {
	t.Parallel()
	config := DefaultReassemblerConfig()
	config.TTL = time.Second
	reassembler, err := NewReassembler(config)
	if err != nil {
		t.Fatalf("create reassembler: %v", err)
	}
	fragments, err := FragmentDatagram(
		DatagramToEdge, uuid.New(), 3, 9, 1, bytes.Repeat([]byte{1}, 2000), 1200,
	)
	if err != nil {
		t.Fatalf("fragment datagram: %v", err)
	}
	now := time.Now()
	if _, _, err := reassembler.Add(fragments[0], now); err != nil {
		t.Fatalf("add fragment: %v", err)
	}
	if removed := reassembler.Prune(now.Add(time.Second)); removed != 1 {
		t.Fatalf("pruned %d messages, want 1", removed)
	}
}

func TestReassemblerPruneReleasesFlowCapacityForAssignmentGeneration(t *testing.T) {
	t.Parallel()
	config := DefaultReassemblerConfig()
	config.MaxMessagesPerFlow = 1
	reassembler, err := NewReassembler(config)
	if err != nil {
		t.Fatalf("create reassembler: %v", err)
	}
	backendID := uuid.New()
	now := time.Now()
	for datagramID := uint32(1); datagramID <= 3; datagramID++ {
		fragments, err := FragmentDatagram(
			DatagramToEdge, backendID, 4, 7, datagramID, bytes.Repeat([]byte{0x33}, 2_000), 1_200,
		)
		if err != nil {
			t.Fatalf("fragment datagram: %v", err)
		}
		if _, _, err := reassembler.Add(fragments[0], now); err != nil {
			t.Fatalf("add fragment of datagram %d: %v", datagramID, err)
		}
		now = now.Add(config.TTL)
		if removed := reassembler.Prune(now); removed != 1 {
			t.Fatalf("pruned %d messages, want 1", removed)
		}
		if len(reassembler.flowCounts) != 0 || reassembler.bytes != 0 {
			t.Fatalf("flow accounting leaked: counts=%v bytes=%d", reassembler.flowCounts, reassembler.bytes)
		}
	}
}

func TestReassemblerRecoversAfterFragmentLossAtConservativePathMTU(t *testing.T) {
	t.Parallel()
	const conservativeTunnelFrameBytes = 1_100
	config := DefaultReassemblerConfig()
	config.TTL = time.Second
	reassembler, err := NewReassembler(config)
	if err != nil {
		t.Fatalf("create reassembler: %v", err)
	}
	backendID := uuid.New()
	payload := bytes.Repeat([]byte{0x5a}, 8_000)
	fragments, err := FragmentDatagram(
		DatagramToEdge,
		backendID,
		3,
		7,
		1,
		payload,
		conservativeTunnelFrameBytes,
	)
	if err != nil {
		t.Fatalf("fragment lossy datagram: %v", err)
	}
	if len(fragments) < 3 {
		t.Fatalf("fragment count = %d, want at least 3", len(fragments))
	}
	now := time.Now()
	for index, fragment := range fragments {
		if index == len(fragments)/2 {
			continue
		}
		if payload, complete, err := reassembler.Add(fragment, now); err != nil {
			t.Fatalf("add surviving fragment: %v", err)
		} else if complete || payload != nil {
			t.Fatal("datagram completed despite a lost fragment")
		}
	}
	if removed := reassembler.Prune(now.Add(config.TTL)); removed != 1 {
		t.Fatalf("pruned incomplete datagrams = %d, want 1", removed)
	}

	retry, err := FragmentDatagram(
		DatagramToEdge,
		backendID,
		3,
		7,
		2,
		payload,
		conservativeTunnelFrameBytes,
	)
	if err != nil {
		t.Fatalf("fragment recovery datagram: %v", err)
	}
	var recovered []byte
	for index := len(retry) - 1; index >= 0; index-- {
		assembled, complete, err := reassembler.Add(retry[index], now.Add(config.TTL))
		if err != nil {
			t.Fatalf("add recovery fragment: %v", err)
		}
		if complete {
			recovered = assembled
		}
	}
	if !bytes.Equal(recovered, payload) {
		t.Fatal("fragment loss poisoned the next datagram on the flow")
	}
}

func TestReassemblerRejectsExcessiveMessageAllocation(t *testing.T) {
	t.Parallel()
	fragment := Datagram{
		Direction:      DatagramToEdge,
		BackendID:      uuid.New(),
		FlowID:         7,
		DatagramID:     1,
		FragmentOffset: 0,
		TotalLength:    MaxUDPMessageBytes + 1,
		Payload:        []byte{1},
	}
	reassembler, err := NewReassembler(DefaultReassemblerConfig())
	if err != nil {
		t.Fatalf("create reassembler: %v", err)
	}
	if _, _, err := reassembler.Add(fragment, time.Now()); err == nil {
		t.Fatal("excessive fragment count was accepted")
	}
}

func TestReassemblerSupportsInterleavedDatagramsOnOneFlow(t *testing.T) {
	t.Parallel()
	backendID := uuid.New()
	firstPayload := bytes.Repeat([]byte{0x11}, 4_000)
	secondPayload := bytes.Repeat([]byte{0x22}, 4_000)
	first, err := FragmentDatagram(
		DatagramToEdge, backendID, 3, 7, 1, firstPayload, 1_200,
	)
	if err != nil {
		t.Fatalf("fragment first datagram: %v", err)
	}
	second, err := FragmentDatagram(
		DatagramToEdge, backendID, 3, 7, 2, secondPayload, 1_200,
	)
	if err != nil {
		t.Fatalf("fragment second datagram: %v", err)
	}
	reassembler, err := NewReassembler(DefaultReassemblerConfig())
	if err != nil {
		t.Fatalf("create reassembler: %v", err)
	}
	var completed [][]byte
	for index := range first {
		for _, fragment := range []Datagram{first[index], second[index]} {
			payload, complete, err := reassembler.Add(fragment, time.Now())
			if err != nil {
				t.Fatalf("add interleaved fragment: %v", err)
			}
			if complete {
				completed = append(completed, payload)
			}
		}
	}
	if len(completed) != 2 ||
		!bytes.Equal(completed[0], firstPayload) ||
		!bytes.Equal(completed[1], secondPayload) {
		t.Fatal("interleaved datagrams were not independently reassembled")
	}
}

func TestReassemblerEnforcesPerFlowCapacity(t *testing.T) {
	t.Parallel()
	config := DefaultReassemblerConfig()
	config.MaxMessagesPerFlow = 1
	reassembler, err := NewReassembler(config)
	if err != nil {
		t.Fatalf("create reassembler: %v", err)
	}
	backendID := uuid.New()
	first, err := FragmentDatagram(
		DatagramToEdge, backendID, 3, 7, 1,
		bytes.Repeat([]byte{0x11}, 2_000), 1_200,
	)
	if err != nil {
		t.Fatalf("fragment first datagram: %v", err)
	}
	second, err := FragmentDatagram(
		DatagramToEdge, backendID, 3, 7, 2,
		bytes.Repeat([]byte{0x22}, 2_000), 1_200,
	)
	if err != nil {
		t.Fatalf("fragment second datagram: %v", err)
	}
	if _, _, err := reassembler.Add(first[0], time.Now()); err != nil {
		t.Fatalf("add first datagram: %v", err)
	}
	if _, _, err := reassembler.Add(second[0], time.Now()); err == nil {
		t.Fatal("second in-flight datagram exceeded the per-flow capacity")
	}
}

func TestReassemblerRejectsOverlappingFragments(t *testing.T) {
	t.Parallel()
	reassembler, err := NewReassembler(DefaultReassemblerConfig())
	if err != nil {
		t.Fatalf("create reassembler: %v", err)
	}
	first := Datagram{
		Direction: DatagramToEdge, BackendID: uuid.New(),
		FlowID: 7, DatagramID: 1, TotalLength: 2_000,
		Payload: bytes.Repeat([]byte{0x11}, 1_000),
	}
	if _, _, err := reassembler.Add(first, time.Now()); err != nil {
		t.Fatalf("add first fragment: %v", err)
	}
	overlap := first
	overlap.FragmentOffset = 500
	overlap.Payload = bytes.Repeat([]byte{0x22}, 1_000)
	if _, _, err := reassembler.Add(overlap, time.Now()); err == nil {
		t.Fatal("overlapping fragment was accepted")
	}
}

func TestParseDatagramRejectsOversizedFrame(t *testing.T) {
	t.Parallel()
	frame := make([]byte, datagramHeaderBytes+MaxUDPMessageBytes+1)
	frame[0] = Version
	if _, err := ParseDatagram(frame); err == nil {
		t.Fatal("oversized datagram frame was accepted")
	}
}
