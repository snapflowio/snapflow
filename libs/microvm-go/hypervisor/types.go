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

package hypervisor

import (
	"fmt"
	"strings"
)

type VMState string

const (
	VMStateRunning VMState = "running"
	VMStatePaused  VMState = "paused"
)

type VMInfo struct {
	State VMState
}

func ParseVMState(value string) (VMState, error) {
	state := VMState(strings.ToLower(strings.TrimSpace(value)))
	switch state {
	case VMStateRunning, VMStatePaused:
		return state, nil
	default:
		return "", fmt.Errorf("unsupported VM state %q", value)
	}
}

type GuestMemoryConfig struct {
	EnableBalloon     bool
	FreePageReporting bool
	DeflateOnOOM      bool
	FreePageHinting   bool
}

type Disk struct {
	Path       string
	Readonly   bool
	Direct     bool
	IOBps      int64
	IOBurstBps int64
}

type Network struct {
	TAPDevice   string
	IP          string
	MAC         string
	Netmask     string
	DownloadBps int64
	UploadBps   int64
}

type VM struct {
	ID            string
	Hypervisor    Hypervisor
	HypervisorBin string
	VCPUs         int
	MemoryBytes   int64
	Disks         []Disk
	Networks      []Network
	SerialLogPath string
	VsockCID      int64
	VsockSocket   string
	PCIDevices    []string
	KernelPath    string
	InitrdPath    string
	KernelArgs    string
	GuestMemory   GuestMemoryConfig
	SocketPath    string
	VMMLogPath    string
	// NetworkNamespace is the path of the sandbox namespace the VMM joins.
	NetworkNamespace string
	Jail             JailPaths
}

// JailPaths are the per-instance host paths a jailed VMM needs beyond its
// boot assets and disks: where it keeps sockets and writes snapshots.
type JailPaths struct {
	Root     string
	Writable []string
	ReadOnly []string
}

type ForkPrepareRequest struct {
	SnapshotPath  string
	SourceDataDir string
	TargetDataDir string
	Target        VM
}

type ForkPrepareResult struct {
	Prepared bool
}

type Capabilities struct {
	Snapshots           bool
	ForkEmbedsNetwork   bool
	SerialConsole       string
	DisableLegacySerial bool
	RestoreConcurrency  int
}
