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
	"errors"
	"fmt"
	"path/filepath"

	"github.com/snapflowio/microvm-go/hypervisor"
)

const (
	rateLimiterRefillMilliseconds = 1000
	defaultMemoryMiB              = 128
)

const snapshotMemoryBackendFile = "File"

var errDirectDiskUnsupported = errors.New("firecracker cannot open disks with direct I/O")

func validateDisks(disks []hypervisor.Disk) error {
	for index, disk := range disks {
		if disk.Direct {
			return fmt.Errorf("disk %d (%s): %w", index, disk.Path, errDirectDiskUnsupported)
		}
	}
	return nil
}

type bootSource struct {
	BootArgs        string `json:"boot_args,omitempty"`
	InitrdPath      string `json:"initrd_path,omitempty"`
	KernelImagePath string `json:"kernel_image_path"`
}

type machineConfiguration struct {
	MemSizeMib int64 `json:"mem_size_mib"`
	VcpuCount  int   `json:"vcpu_count"`
}

type drive struct {
	DriveID      string       `json:"drive_id"`
	IsRootDevice bool         `json:"is_root_device"`
	IsReadOnly   bool         `json:"is_read_only,omitempty"`
	PathOnHost   string       `json:"path_on_host,omitempty"`
	RateLimiter  *rateLimiter `json:"rate_limiter,omitempty"`
}

type networkInterface struct {
	GuestMAC      string       `json:"guest_mac,omitempty"`
	HostDevName   string       `json:"host_dev_name"`
	IfaceID       string       `json:"iface_id"`
	RxRateLimiter *rateLimiter `json:"rx_rate_limiter,omitempty"`
	TxRateLimiter *rateLimiter `json:"tx_rate_limiter,omitempty"`
}

type vsock struct {
	GuestCID int64  `json:"guest_cid"`
	UDSPath  string `json:"uds_path"`
}

type serialDevice struct {
	SerialOutPath string `json:"serial_out_path"`
}

type balloon struct {
	AmountMib         int64 `json:"amount_mib"`
	DeflateOnOOM      bool  `json:"deflate_on_oom"`
	FreePageHinting   bool  `json:"free_page_hinting,omitempty"`
	FreePageReporting bool  `json:"free_page_reporting,omitempty"`
}

type instanceActionInfo struct {
	ActionType string `json:"action_type"`
}

type vmState struct {
	State string `json:"state"`
}

type snapshotLoadParams struct {
	SnapshotPath    string             `json:"snapshot_path"`
	MemBackend      snapshotMemBackend `json:"mem_backend"`
	ResumeVM        bool               `json:"resume_vm,omitempty"`
	ClockRealtime   bool               `json:"clock_realtime"`
	NetworkOverride []networkInterface `json:"network_overrides,omitempty"`
	VsockOverride   *vsockOverride     `json:"vsock_override,omitempty"`
}

type vsockOverride struct {
	UDSPath string `json:"uds_path"`
}

type snapshotMemBackend struct {
	BackendPath string `json:"backend_path"`
	BackendType string `json:"backend_type"`
}

type snapshotCreateParams struct {
	MemFilePath  string `json:"mem_file_path"`
	SnapshotPath string `json:"snapshot_path"`
	SnapshotType string `json:"snapshot_type,omitempty"`
}

type rateLimiter struct {
	Bandwidth *tokenBucket `json:"bandwidth,omitempty"`
}

type tokenBucket struct {
	OneTimeBurst *int64 `json:"one_time_burst,omitempty"`
	RefillTime   int64  `json:"refill_time"`
	Size         int64  `json:"size"`
}

type instanceInfo struct {
	State string `json:"state"`
}

func toBootSource(cfg hypervisor.VM) bootSource {
	return bootSource{
		BootArgs:        cfg.KernelArgs,
		InitrdPath:      cfg.InitrdPath,
		KernelImagePath: cfg.KernelPath,
	}
}

func toMachineConfiguration(cfg hypervisor.VM) machineConfiguration {
	vcpus := cfg.VCPUs
	if vcpus <= 0 {
		vcpus = 1
	}
	return machineConfiguration{
		MemSizeMib: bytesToMiB(cfg.MemoryBytes),
		VcpuCount:  vcpus,
	}
}

func toDriveConfigs(cfg hypervisor.VM) []drive {
	out := make([]drive, 0, len(cfg.Disks))
	for i, disk := range cfg.Disks {
		id := fmt.Sprintf("disk%d", i)
		if i == 0 {
			id = "rootfs"
		}
		out = append(out, drive{
			DriveID:      id,
			IsRootDevice: i == 0,
			IsReadOnly:   disk.Readonly,
			PathOnHost:   disk.Path,
			RateLimiter:  toRateLimiter(disk.IOBps, disk.IOBurstBps),
		})
	}
	return out
}

func toNetworkInterfaces(cfg hypervisor.VM) []networkInterface {
	out := make([]networkInterface, 0, len(cfg.Networks))
	for i, network := range cfg.Networks {
		out = append(out, networkInterface{
			GuestMAC:      network.MAC,
			HostDevName:   network.TAPDevice,
			IfaceID:       fmt.Sprintf("eth%d", i),
			RxRateLimiter: toRateLimiter(network.DownloadBps, network.DownloadBps),
			TxRateLimiter: toRateLimiter(network.UploadBps, network.UploadBps),
		})
	}
	return out
}

func toVsockConfig(cfg hypervisor.VM) *vsock {
	if cfg.VsockCID <= 0 || cfg.VsockSocket == "" {
		return nil
	}
	return &vsock{
		GuestCID: cfg.VsockCID,
		UDSPath:  cfg.VsockSocket,
	}
}

func toBalloonConfig(cfg hypervisor.VM) *balloon {
	if !cfg.GuestMemory.EnableBalloon {
		return nil
	}
	return &balloon{
		AmountMib:         0,
		DeflateOnOOM:      cfg.GuestMemory.DeflateOnOOM,
		FreePageHinting:   cfg.GuestMemory.FreePageHinting,
		FreePageReporting: cfg.GuestMemory.FreePageReporting,
	}
}

func toRateLimiter(limit, burst int64) *rateLimiter {
	if limit <= 0 {
		return nil
	}
	var oneTimeBurst *int64
	if burst > limit {
		extra := burst - limit
		oneTimeBurst = &extra
	}
	return &rateLimiter{
		Bandwidth: &tokenBucket{
			OneTimeBurst: oneTimeBurst,
			RefillTime:   rateLimiterRefillMilliseconds,
			Size:         limit,
		},
	}
}

func toSnapshotCreateParams(snapshotDir string) snapshotCreateParams {
	return snapshotCreateParams{
		MemFilePath:  filepath.Join(snapshotDir, "memory"),
		SnapshotPath: filepath.Join(snapshotDir, "state"),
		SnapshotType: "Full",
	}
}

func toSnapshotLoadParams(snapshotDir string, cfg hypervisor.VM) snapshotLoadParams {
	params := snapshotLoadParams{
		SnapshotPath: filepath.Join(snapshotDir, "state"),
		MemBackend: snapshotMemBackend{
			BackendPath: filepath.Join(snapshotDir, "memory"),
			BackendType: snapshotMemoryBackendFile,
		},
		ResumeVM:        false,
		ClockRealtime:   true,
		NetworkOverride: toNetworkInterfaces(cfg),
	}
	if cfg.VsockCID > 0 && cfg.VsockSocket != "" {
		params.VsockOverride = &vsockOverride{UDSPath: cfg.VsockSocket}
	}
	return params
}

func bytesToMiB(bytes int64) int64 {
	if bytes <= 0 {
		return defaultMemoryMiB
	}
	const mib = 1024 * 1024
	out := bytes / mib
	if bytes%mib != 0 {
		out++
	}
	if out < 1 {
		out = 1
	}
	return out
}
