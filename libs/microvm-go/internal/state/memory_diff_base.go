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

package state

import "github.com/snapflowio/microvm-go/hypervisor"

type MemoryDiffBaseSource string

const (
	MemoryDiffBaseNone     MemoryDiffBaseSource = "none"
	MemoryDiffBaseUnknown  MemoryDiffBaseSource = "unknown"
	MemoryDiffBaseZero     MemoryDiffBaseSource = "zero"
	MemoryDiffBaseMapped   MemoryDiffBaseSource = "mapped"
	MemoryDiffBaseRetained MemoryDiffBaseSource = "retained"
)

type FileIdentity struct {
	Device        uint64 `json:"device"`
	Inode         uint64 `json:"inode"`
	SizeBytes     int64  `json:"sizeBytes"`
	ModifiedNanos int64  `json:"modifiedNanos"`
}

type MemoryDiffBase struct {
	VMM        hypervisor.Process   `json:"vmm"`
	Source     MemoryDiffBaseSource `json:"source"`
	File       *FileIdentity        `json:"file,omitempty"`
	Generation uint64               `json:"generation"`
}

func NewMemoryDiffBase(vmm hypervisor.Process, source MemoryDiffBaseSource, file *FileIdentity) *MemoryDiffBase {
	return &MemoryDiffBase{VMM: vmm, Source: source, File: file}
}

func (base *MemoryDiffBase) Invalidated() *MemoryDiffBase {
	if base == nil {
		return nil
	}
	return &MemoryDiffBase{VMM: base.VMM, Source: MemoryDiffBaseUnknown, Generation: base.Generation}
}

func (base *MemoryDiffBase) Retained(file FileIdentity) *MemoryDiffBase {
	return &MemoryDiffBase{VMM: base.VMM, Source: MemoryDiffBaseRetained, File: &file, Generation: base.Generation + 1}
}

func (base *MemoryDiffBase) SourceOrNone() MemoryDiffBaseSource {
	if base == nil {
		return MemoryDiffBaseNone
	}
	return base.Source
}

func (base *MemoryDiffBase) TracksVMM(process hypervisor.Process) bool {
	return base != nil && process.PID == base.VMM.PID && process.StartToken == base.VMM.StartToken
}
