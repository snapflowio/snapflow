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
	"encoding/json"
	"errors"
	"fmt"
	"io"

	"github.com/snapflowio/tunnel-go/streamio"
)

const (
	MaxControlFrameBytes   = 64 * 1024
	MaxHeartbeatFrameBytes = 1024 * 1024
)

func WriteFrame[T any](writer io.Writer, value T) error {
	return WriteFrameLimit(writer, value, MaxControlFrameBytes)
}

func WriteFrameLimit[T any](writer io.Writer, value T, limit uint32) error {
	if limit == 0 {
		return errors.New("control frame limit is required")
	}
	payload, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("encode control frame: %w", err)
	}
	if len(payload) == 0 || uint64(len(payload)) > uint64(limit) {
		return fmt.Errorf("control frame size %d is outside 1-%d", len(payload), limit)
	}
	var length [4]byte
	binary.BigEndian.PutUint32(length[:], uint32(len(payload)))
	if err := streamio.WriteAll(writer, length[:]); err != nil {
		return fmt.Errorf("write control frame length: %w", err)
	}
	if err := streamio.WriteAll(writer, payload); err != nil {
		return fmt.Errorf("write control frame payload: %w", err)
	}
	return nil
}

func ReadFrame[T any](reader io.Reader, destination *T) error {
	return ReadFrameLimit(reader, destination, MaxControlFrameBytes)
}

func ReadFrameLimit[T any](reader io.Reader, destination *T, limit uint32) error {
	if destination == nil {
		return errors.New("control frame destination is required")
	}
	if limit == 0 {
		return errors.New("control frame limit is required")
	}
	var length [4]byte
	if _, err := io.ReadFull(reader, length[:]); err != nil {
		return fmt.Errorf("read control frame length: %w", err)
	}
	size := binary.BigEndian.Uint32(length[:])
	if size == 0 || size > limit {
		return fmt.Errorf("control frame size %d is outside 1-%d", size, limit)
	}
	payload := make([]byte, size)
	if _, err := io.ReadFull(reader, payload); err != nil {
		return fmt.Errorf("read control frame payload: %w", err)
	}
	if err := json.Unmarshal(payload, destination); err != nil {
		return fmt.Errorf("decode control frame: %w", err)
	}
	return nil
}
