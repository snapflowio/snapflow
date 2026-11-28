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
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

const (
	defaultReassemblyMessages        = 1_024
	defaultReassemblyMessagesPerFlow = 8
	defaultReassemblyBytes           = 32 << 20
	defaultReassemblyTTL             = 5 * time.Second
)

var (
	errReassemblyCapacity    = errors.New("reassembly capacity reached")
	errReassemblyLength      = errors.New("datagram length changed during reassembly")
	errConflictingDuplicate  = errors.New("conflicting duplicate fragment")
	errOverlappingFragments  = errors.New("overlapping datagram fragments")
	errInconsistentFragments = errors.New("datagram fragment accounting is inconsistent")
)

type ReassemblerConfig struct {
	MaxMessages        int
	MaxMessagesPerFlow int
	MaxBytes           int
	TTL                time.Duration
}

func DefaultReassemblerConfig() ReassemblerConfig {
	return ReassemblerConfig{
		MaxMessages:        defaultReassemblyMessages,
		MaxMessagesPerFlow: defaultReassemblyMessagesPerFlow,
		MaxBytes:           defaultReassemblyBytes,
		TTL:                defaultReassemblyTTL,
	}
}

type reassemblyFlowKey struct {
	direction            DatagramDirection
	backendID            uuid.UUID
	assignmentGeneration uint32
	flowID               uint64
}

type reassemblyKey struct {
	reassemblyFlowKey
	datagramID uint32
}

func newReassemblyKey(fragment Datagram) reassemblyKey {
	return reassemblyKey{
		reassemblyFlowKey: reassemblyFlowKey{
			direction:            fragment.Direction,
			backendID:            fragment.BackendID,
			assignmentGeneration: fragment.AssignmentGeneration,
			flowID:               fragment.FlowID,
		},
		datagramID: fragment.DatagramID,
	}
}

type partialMessage struct {
	createdAt time.Time
	fragments map[uint32]uint32
	payload   []byte
	received  int
}

type Reassembler struct {
	mu         sync.Mutex
	config     ReassemblerConfig
	messages   map[reassemblyKey]*partialMessage
	flowCounts map[reassemblyFlowKey]int
	bytes      int
}

func NewReassembler(config ReassemblerConfig) (*Reassembler, error) {
	if config.MaxMessages < 1 ||
		config.MaxMessagesPerFlow < 1 ||
		config.MaxMessagesPerFlow > config.MaxMessages ||
		config.MaxBytes < MaxUDPMessageBytes ||
		config.TTL <= 0 {
		return nil, errors.New("invalid reassembler limits")
	}
	return &Reassembler{
		config:     config,
		messages:   make(map[reassemblyKey]*partialMessage),
		flowCounts: make(map[reassemblyFlowKey]int),
	}, nil
}

func (r *Reassembler) Add(fragment Datagram, now time.Time) ([]byte, bool, error) {
	if err := fragment.Validate(); err != nil {
		return nil, false, err
	}
	if int(fragment.TotalLength) == len(fragment.Payload) && fragment.FragmentOffset == 0 {
		return append([]byte(nil), fragment.Payload...), true, nil
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.pruneLocked(now)

	key := newReassemblyKey(fragment)
	message, err := r.messageLocked(key, int(fragment.TotalLength), now)
	if err != nil {
		return nil, false, err
	}
	accepted, err := message.place(fragment)
	if err != nil {
		r.removeLocked(key, message)
		return nil, false, err
	}
	if !accepted || message.received != len(message.payload) {
		return nil, false, nil
	}
	r.removeLocked(key, message)
	if !contiguous(message.fragments, len(message.payload)) {
		return nil, false, errInconsistentFragments
	}
	return message.payload, true, nil
}

func (r *Reassembler) messageLocked(key reassemblyKey, totalLength int, now time.Time) (*partialMessage, error) {
	if message := r.messages[key]; message != nil {
		if len(message.payload) == totalLength {
			return message, nil
		}
		r.removeLocked(key, message)
		return nil, errReassemblyLength
	}
	if len(r.messages) >= r.config.MaxMessages ||
		r.flowCounts[key.reassemblyFlowKey] >= r.config.MaxMessagesPerFlow ||
		r.bytes+totalLength > r.config.MaxBytes {
		return nil, errReassemblyCapacity
	}
	message := &partialMessage{
		createdAt: now,
		fragments: make(map[uint32]uint32),
		payload:   make([]byte, totalLength),
	}
	r.messages[key] = message
	r.flowCounts[key.reassemblyFlowKey]++
	r.bytes += totalLength
	return message, nil
}

func (message *partialMessage) place(fragment Datagram) (bool, error) {
	start := int(fragment.FragmentOffset)
	end := start + len(fragment.Payload)
	if previousLength, exists := message.fragments[fragment.FragmentOffset]; exists {
		if int(previousLength) == len(fragment.Payload) &&
			bytes.Equal(message.payload[start:end], fragment.Payload) {
			return false, nil
		}
		return false, errConflictingDuplicate
	}
	for offset, length := range message.fragments {
		if start < int(offset)+int(length) && int(offset) < end {
			return false, errOverlappingFragments
		}
	}
	copy(message.payload[start:end], fragment.Payload)
	message.fragments[fragment.FragmentOffset] = uint32(len(fragment.Payload))
	message.received += len(fragment.Payload)
	return true, nil
}

func contiguous(fragments map[uint32]uint32, total int) bool {
	offset := 0
	for offset < total {
		length, exists := fragments[uint32(offset)]
		if !exists || length == 0 {
			return false
		}
		offset += int(length)
	}
	return offset == total
}

func (r *Reassembler) Prune(now time.Time) int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.pruneLocked(now)
}

func (r *Reassembler) pruneLocked(now time.Time) int {
	removed := 0
	for key, message := range r.messages {
		if now.Sub(message.createdAt) >= r.config.TTL {
			r.removeLocked(key, message)
			removed++
		}
	}
	return removed
}

func (r *Reassembler) removeLocked(key reassemblyKey, message *partialMessage) {
	delete(r.messages, key)
	r.bytes -= len(message.payload)
	if remaining := r.flowCounts[key.reassemblyFlowKey] - 1; remaining > 0 {
		r.flowCounts[key.reassemblyFlowKey] = remaining
	} else {
		delete(r.flowCounts, key.reassemblyFlowKey)
	}
}
