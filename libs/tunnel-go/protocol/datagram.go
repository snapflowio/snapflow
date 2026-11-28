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
	"encoding/binary"
	"errors"
	"fmt"

	"github.com/google/uuid"
)

const (
	datagramHeaderBytes           = 42
	MaxUDPApplicationPayloadBytes = 65_507
	MaxProxyV2HeaderBytes         = 52
	MaxUDPMessageBytes            = MaxUDPApplicationPayloadBytes + MaxProxyV2HeaderBytes
	MaxDatagramFragments          = 64
)

type DatagramDirection uint8

const (
	DatagramToMachine DatagramDirection = iota
	DatagramToEdge
)

type Datagram struct {
	Direction            DatagramDirection
	BackendID            uuid.UUID
	AssignmentGeneration uint32
	FlowID               uint64
	DatagramID           uint32
	FragmentOffset       uint32
	TotalLength          uint32
	Payload              []byte
}

func FragmentDatagram(
	direction DatagramDirection,
	backendID uuid.UUID,
	assignmentGeneration uint32,
	flowID uint64,
	datagramID uint32,
	payload []byte,
	maxFrameBytes int,
) ([]Datagram, error) {
	if backendID == uuid.Nil {
		return nil, errors.New("backend ID is required")
	}
	if flowID == 0 {
		return nil, errors.New("flow ID is required")
	}
	if datagramID == 0 {
		return nil, errors.New("datagram ID is required")
	}
	if len(payload) == 0 || len(payload) > MaxUDPMessageBytes {
		return nil, fmt.Errorf("UDP payload size %d is outside 1-%d", len(payload), MaxUDPMessageBytes)
	}
	maxPayload := maxFrameBytes - datagramHeaderBytes
	if maxPayload <= 0 {
		return nil, fmt.Errorf("maximum frame size must exceed %d bytes", datagramHeaderBytes)
	}
	count := (len(payload) + maxPayload - 1) / maxPayload
	if count > MaxDatagramFragments {
		return nil, errors.New("UDP payload requires too many fragments")
	}
	fragments := make([]Datagram, 0, count)
	for offset := 0; offset < len(payload); offset += maxPayload {
		end := min(offset+maxPayload, len(payload))
		fragments = append(fragments, Datagram{
			Direction: direction, BackendID: backendID, FlowID: flowID,
			AssignmentGeneration: assignmentGeneration,
			DatagramID:           datagramID, FragmentOffset: uint32(offset),
			TotalLength: uint32(len(payload)),
			Payload:     append([]byte(nil), payload[offset:end]...),
		})
	}
	return fragments, nil
}

func (d Datagram) MarshalBinary() ([]byte, error) {
	if err := d.Validate(); err != nil {
		return nil, err
	}
	frame := make([]byte, datagramHeaderBytes+len(d.Payload))
	frame[0] = Version
	frame[1] = byte(d.Direction)
	copy(frame[2:18], d.BackendID[:])
	binary.BigEndian.PutUint32(frame[18:22], d.AssignmentGeneration)
	binary.BigEndian.PutUint64(frame[22:30], d.FlowID)
	binary.BigEndian.PutUint32(frame[30:34], d.DatagramID)
	binary.BigEndian.PutUint32(frame[34:38], d.FragmentOffset)
	binary.BigEndian.PutUint32(frame[38:42], d.TotalLength)
	copy(frame[42:], d.Payload)
	return frame, nil
}

func ParseDatagram(frame []byte) (Datagram, error) {
	if len(frame) <= datagramHeaderBytes {
		return Datagram{}, errors.New("datagram frame is too short")
	}
	if len(frame) > datagramHeaderBytes+MaxUDPMessageBytes {
		return Datagram{}, fmt.Errorf(
			"datagram frame size %d exceeds maximum %d",
			len(frame),
			datagramHeaderBytes+MaxUDPMessageBytes,
		)
	}
	if frame[0] != Version {
		return Datagram{}, fmt.Errorf("unsupported datagram version %d", frame[0])
	}
	datagram := Datagram{
		Direction:            DatagramDirection(frame[1]),
		BackendID:            uuid.UUID(frame[2:18]),
		AssignmentGeneration: binary.BigEndian.Uint32(frame[18:22]),
		FlowID:               binary.BigEndian.Uint64(frame[22:30]),
		DatagramID:           binary.BigEndian.Uint32(frame[30:34]),
		FragmentOffset:       binary.BigEndian.Uint32(frame[34:38]),
		TotalLength:          binary.BigEndian.Uint32(frame[38:42]),
		Payload:              append([]byte(nil), frame[42:]...),
	}
	if err := datagram.Validate(); err != nil {
		return Datagram{}, err
	}
	return datagram, nil
}

func (d Datagram) Validate() error {
	if d.Direction != DatagramToMachine && d.Direction != DatagramToEdge {
		return errors.New("invalid datagram direction")
	}
	if d.BackendID == uuid.Nil || d.FlowID == 0 || d.DatagramID == 0 {
		return errors.New("backend, flow, and datagram IDs are required")
	}
	if len(d.Payload) == 0 || len(d.Payload) > MaxUDPMessageBytes {
		return errors.New("invalid datagram payload size")
	}
	end := int(d.FragmentOffset) + len(d.Payload)
	if d.TotalLength == 0 ||
		int(d.TotalLength) > MaxUDPMessageBytes ||
		end > int(d.TotalLength) {
		return errors.New("invalid datagram fragment range")
	}
	return nil
}
