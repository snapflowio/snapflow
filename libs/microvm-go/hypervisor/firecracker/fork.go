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

package firecracker

import (
	"bytes"
	"context"
	"encoding/binary"
	"fmt"
	"os"
	"path/filepath"

	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/internal/filemode"
)

const snapshotCRCBytes = 8

const snapshotCRC64JonesReversedPolynomial uint64 = 0x95ac9329ac4bc9b5

func (Backend) PrepareFork(ctx context.Context, request hypervisor.ForkPrepareRequest) (hypervisor.ForkPrepareResult, error) {
	if err := ctx.Err(); err != nil {
		return hypervisor.ForkPrepareResult{}, err
	}
	if request.SnapshotPath == "" {
		return hypervisor.ForkPrepareResult{Prepared: true}, nil
	}
	statePath := filepath.Join(request.SnapshotPath, "state")
	data, err := os.ReadFile(statePath)
	if err != nil {
		return hypervisor.ForkPrepareResult{}, fmt.Errorf("read Firecracker snapshot state: %w", err)
	}
	if len(data) < snapshotCRCBytes {
		return hypervisor.ForkPrepareResult{}, fmt.Errorf("firecracker snapshot state is too short")
	}
	if snapshotCRC64(data) != 0 {
		return hypervisor.ForkPrepareResult{}, fmt.Errorf("firecracker snapshot CRC64 validation failed before fork rewrite")
	}
	body := append([]byte(nil), data[:len(data)-snapshotCRCBytes]...)
	sourceDir := filepath.Clean(request.SourceDataDir)
	targetDir := filepath.Clean(request.TargetDataDir)
	if sourceDir == "." || targetDir == "." || sourceDir == targetDir {
		return hypervisor.ForkPrepareResult{Prepared: true}, nil
	}
	if !bytes.Contains(body, []byte(sourceDir)) {
		return hypervisor.ForkPrepareResult{Prepared: true}, nil
	}
	if len(sourceDir) != len(targetDir) {
		return hypervisor.ForkPrepareResult{}, fmt.Errorf("firecracker snapshot paths cannot be rewritten from %d to %d bytes", len(sourceDir), len(targetDir))
	}
	body = bytes.ReplaceAll(body, []byte(sourceDir), []byte(targetDir))
	out := make([]byte, len(body)+snapshotCRCBytes)
	copy(out, body)
	binary.LittleEndian.PutUint64(out[len(body):], snapshotCRC64(body))
	if snapshotCRC64(out) != 0 {
		return hypervisor.ForkPrepareResult{}, fmt.Errorf("firecracker snapshot CRC64 validation failed after fork rewrite")
	}
	if err := os.WriteFile(statePath, out, filemode.SharedFile); err != nil {
		return hypervisor.ForkPrepareResult{}, fmt.Errorf("write Firecracker fork snapshot state: %w", err)
	}
	return hypervisor.ForkPrepareResult{Prepared: true}, nil
}

func snapshotCRC64(data []byte) uint64 {
	crc := uint64(0)
	for _, value := range data {
		crc ^= uint64(value)
		for range 8 {
			if crc&1 != 0 {
				crc = (crc >> 1) ^ snapshotCRC64JonesReversedPolynomial
			} else {
				crc >>= 1
			}
		}
	}
	return crc
}
