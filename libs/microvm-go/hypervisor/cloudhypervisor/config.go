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

package cloudhypervisor

import (
	"path/filepath"
	"strings"

	"github.com/snapflowio/microvm-go/hypervisor"
)

const (
	landlockReadAccess      = "r"
	landlockReadWriteAccess = "rw"
	virtualNetworkSysfsRoot = "/sys/devices/virtual/net"
	consoleModeOff          = "Off"
	consoleModeFile         = "File"
	rawImageType            = "Raw"
	defaultMemoryBytes      = 128 * 1024 * 1024
)

type vmConfig struct {
	Payload        *payloadConfig  `json:"payload,omitempty"`
	Cpus           *cpusConfig     `json:"cpus,omitempty"`
	Memory         *memoryConfig   `json:"memory,omitempty"`
	Disks          *[]diskConfig   `json:"disks,omitempty"`
	Net            *[]netConfig    `json:"net,omitempty"`
	Vsock          *vsockConfig    `json:"vsock,omitempty"`
	Devices        *[]deviceConfig `json:"devices,omitempty"`
	Serial         *consoleConfig  `json:"serial,omitempty"`
	Console        *consoleConfig  `json:"console,omitempty"`
	Balloon        *balloonConfig  `json:"balloon,omitempty"`
	LandlockEnable bool            `json:"landlock_enable"`
	LandlockRules  []landlockRule  `json:"landlock_rules,omitempty"`
}

type landlockRule struct {
	Path   string `json:"path"`
	Access string `json:"access"`
}

type payloadConfig struct {
	Kernel    *string `json:"kernel,omitempty"`
	Cmdline   *string `json:"cmdline,omitempty"`
	Initramfs *string `json:"initramfs,omitempty"`
}

type cpusConfig struct {
	BootVcpus int `json:"boot_vcpus"`
	MaxVcpus  int `json:"max_vcpus"`
}

type memoryConfig struct {
	Size int64 `json:"size"`
}

type diskConfig struct {
	Path      *string `json:"path,omitempty"`
	Readonly  *bool   `json:"readonly,omitempty"`
	Direct    *bool   `json:"direct,omitempty"`
	ImageType *string `json:"image_type,omitempty"`
}

type netConfig struct {
	Tap  *string `json:"tap,omitempty"`
	IP   *string `json:"ip,omitempty"`
	Mac  *string `json:"mac,omitempty"`
	Mask *string `json:"mask,omitempty"`
}

type vsockConfig struct {
	Cid    int64  `json:"cid"`
	Socket string `json:"socket"`
}

type deviceConfig struct {
	Path string `json:"path"`
}

type consoleConfig struct {
	Mode   string  `json:"mode"`
	File   *string `json:"file,omitempty"`
	Socket *string `json:"socket,omitempty"`
}

type balloonConfig struct {
	Size              int64 `json:"size"`
	DeflateOnOom      *bool `json:"deflate_on_oom,omitempty"`
	FreePageReporting *bool `json:"free_page_reporting,omitempty"`
}

type vmInfo struct {
	State string `json:"state"`
}

type vmSnapshotConfig struct {
	DestinationURL *string `json:"destination_url,omitempty"`
}

type restoreConfig struct {
	SourceURL string `json:"source_url"`
	Prefault  *bool  `json:"prefault,omitempty"`
}

func toVMConfig(cfg hypervisor.VM) vmConfig {
	vcpus := max(cfg.VCPUs, 1)
	disks := diskConfigs(cfg.Disks)
	return vmConfig{
		Payload: &payloadConfig{
			Kernel:    ptr(cfg.KernelPath),
			Cmdline:   ptr(cfg.KernelArgs),
			Initramfs: ptr(cfg.InitrdPath),
		},
		Cpus: &cpusConfig{
			BootVcpus: vcpus,
			MaxVcpus:  vcpus,
		},
		Memory:         &memoryConfig{Size: bytesToMemoryBytes(cfg.MemoryBytes)},
		Disks:          &disks,
		Net:            netConfigs(cfg.Networks),
		Vsock:          vsockConfiguration(cfg),
		Devices:        deviceConfigs(cfg.PCIDevices),
		Serial:         serialConfiguration(cfg.SerialLogPath),
		Console:        &consoleConfig{Mode: consoleModeOff},
		Balloon:        balloonConfiguration(cfg.GuestMemory),
		LandlockEnable: true,
		LandlockRules:  landlockRules(cfg),
	}
}

func diskConfigs(disks []hypervisor.Disk) []diskConfig {
	configs := make([]diskConfig, 0, len(disks))
	for _, disk := range disks {
		config := diskConfig{
			Path:      ptr(disk.Path),
			Readonly:  ptr(disk.Readonly),
			ImageType: ptr(rawImageType),
		}
		if disk.Direct {
			config.Direct = ptr(true)
		}
		configs = append(configs, config)
	}
	return configs
}

func netConfigs(networks []hypervisor.Network) *[]netConfig {
	if len(networks) == 0 {
		return nil
	}
	values := make([]netConfig, 0, len(networks))
	for _, network := range networks {
		values = append(values, netConfig{
			Tap:  ptr(network.TAPDevice),
			IP:   ptr(network.IP),
			Mac:  ptr(network.MAC),
			Mask: ptr(network.Netmask),
		})
	}
	return &values
}

func vsockConfiguration(cfg hypervisor.VM) *vsockConfig {
	if cfg.VsockCID <= 0 || cfg.VsockSocket == "" {
		return nil
	}
	return &vsockConfig{Cid: cfg.VsockCID, Socket: cfg.VsockSocket}
}

func deviceConfigs(paths []string) *[]deviceConfig {
	if len(paths) == 0 {
		return nil
	}
	values := make([]deviceConfig, 0, len(paths))
	for _, path := range paths {
		values = append(values, deviceConfig{Path: path})
	}
	return &values
}

func balloonConfiguration(memory hypervisor.GuestMemoryConfig) *balloonConfig {
	if !memory.EnableBalloon {
		return nil
	}
	balloon := &balloonConfig{Size: 0}
	if memory.DeflateOnOOM {
		balloon.DeflateOnOom = ptr(true)
	}
	if memory.FreePageReporting {
		balloon.FreePageReporting = ptr(true)
	}
	return balloon
}

func serialConfiguration(serialLogPath string) *consoleConfig {
	if strings.TrimSpace(serialLogPath) == "" {
		return &consoleConfig{Mode: consoleModeOff}
	}
	return &consoleConfig{Mode: consoleModeFile, File: ptr(serialLogPath)}
}

// landlockRules mirror the jail: Cloud Hypervisor grants its own config paths
// (payload, disks, consoles, VFIO groups), and these add the directories the
// jail binds for its socket and snapshots plus the TAP it inspects in sysfs.
func landlockRules(cfg hypervisor.VM) []landlockRule {
	rules := make([]landlockRule, 0, len(cfg.Jail.Writable)+len(cfg.Jail.ReadOnly)+len(cfg.Networks))
	for _, path := range cfg.Jail.Writable {
		rules = append(rules, landlockRule{Path: path, Access: landlockReadWriteAccess})
	}
	for _, path := range cfg.Jail.ReadOnly {
		rules = append(rules, landlockRule{Path: path, Access: landlockReadAccess})
	}
	for _, network := range cfg.Networks {
		if tapDevice := strings.TrimSpace(network.TAPDevice); tapDevice != "" {
			rules = append(rules, landlockRule{
				Path:   filepath.Join(virtualNetworkSysfsRoot, tapDevice),
				Access: landlockReadAccess,
			})
		}
	}
	return rules
}

func bytesToMemoryBytes(bytes int64) int64 {
	if bytes <= 0 {
		return defaultMemoryBytes
	}
	return bytes
}

func ptr[T any](value T) *T {
	return &value
}
