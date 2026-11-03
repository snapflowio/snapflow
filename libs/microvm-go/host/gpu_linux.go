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

//go:build linux

package host

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

const pciClassPrefixLength = 4

const (
	sysfsPCIDevicesPath = "/sys/bus/pci/devices"
	sysfsIOMMUPath      = "/sys/kernel/iommu_groups"
	mdevBusPath         = "/sys/class/mdev_bus"
)

var pciAddressPattern = regexp.MustCompile(`^[0-9a-fA-F]{4}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}\.[0-9a-fA-F]$`)

func DetectGPUStatus() GPUStatus {
	if entries, err := os.ReadDir(mdevBusPath); err == nil && len(entries) > 0 {
		return GPUStatus{Mode: GPUModeVGPU}
	}

	devices, err := DiscoverPassthroughGPUs()
	if err == nil && len(devices) > 0 {
		return GPUStatus{Mode: GPUModePassthrough, Devices: devices}
	}

	return GPUStatus{Mode: GPUModeNone}
}

func DiscoverPassthroughGPUs() ([]GPUDevice, error) {
	entries, err := os.ReadDir(sysfsPCIDevicesPath)
	if err != nil {
		return nil, fmt.Errorf("read PCI devices: %w", err)
	}

	devices := make([]GPUDevice, 0)
	for _, entry := range entries {
		address := entry.Name()
		if !pciAddressPattern.MatchString(address) {
			continue
		}

		device, err := readGPUDevice(address)
		if err != nil || !isGPUDevice(device) {
			continue
		}
		devices = append(devices, device)
	}

	return devices, nil
}

func readGPUDevice(address string) (GPUDevice, error) {
	devicePath := filepath.Join(sysfsPCIDevicesPath, address)

	vendorID, err := readSysfsTrimmed(filepath.Join(devicePath, "vendor"))
	if err != nil {
		return GPUDevice{}, fmt.Errorf("read vendor for %s: %w", address, err)
	}
	deviceID, err := readSysfsTrimmed(filepath.Join(devicePath, "device"))
	if err != nil {
		return GPUDevice{}, fmt.Errorf("read device for %s: %w", address, err)
	}
	classCode, classErr := readSysfsTrimmed(filepath.Join(devicePath, "class"))
	if classErr != nil {
		classCode = ""
	}
	iommuGroup, iommuErr := readIOMMUGroup(address)
	if iommuErr != nil {
		iommuGroup = noIOMMUGroup
	}

	return GPUDevice{
		PCIAddress:    address,
		VendorID:      strings.TrimPrefix(vendorID, "0x"),
		DeviceID:      strings.TrimPrefix(deviceID, "0x"),
		VendorName:    vendorName(strings.TrimPrefix(vendorID, "0x")),
		DeviceName:    gpuDeviceName(strings.TrimPrefix(vendorID, "0x"), classCode),
		IOMMUGroup:    iommuGroup,
		CurrentDriver: currentDriver(address),
	}, nil
}

func isGPUDevice(device GPUDevice) bool {
	devicePath := filepath.Join(sysfsPCIDevicesPath, device.PCIAddress)
	classCode, err := readSysfsTrimmed(filepath.Join(devicePath, "class"))
	if err != nil {
		return false
	}
	classCode = strings.TrimPrefix(classCode, "0x")
	if len(classCode) < pciClassPrefixLength {
		return false
	}
	switch classCode[:pciClassPrefixLength] {
	case "0300", "0302":
		return true
	default:
		return false
	}
}

func readIOMMUGroup(address string) (int, error) {
	target, err := os.Readlink(filepath.Join(sysfsPCIDevicesPath, address, "iommu_group"))
	if err != nil {
		return -1, fmt.Errorf("read IOMMU group for %s: %w", address, err)
	}

	group, err := strconv.Atoi(filepath.Base(target))
	if err != nil {
		return -1, fmt.Errorf("parse IOMMU group for %s: %w", address, err)
	}
	return group, nil
}

func currentDriver(address string) string {
	target, err := os.Readlink(filepath.Join(sysfsPCIDevicesPath, address, "driver"))
	if err != nil {
		return ""
	}
	return filepath.Base(target)
}

func readSysfsTrimmed(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(data)), nil
}

func vendorName(vendorID string) string {
	switch vendorID {
	case "10de":
		return "NVIDIA"
	case "1002":
		return "AMD"
	case "8086":
		return "Intel"
	default:
		return "Unknown"
	}
}

func gpuDeviceName(vendorID, classCode string) string {
	if vendorID == "10de" {
		return "NVIDIA GPU"
	}
	classCode = strings.TrimPrefix(classCode, "0x")
	if len(classCode) >= 4 && classCode[:4] == "0302" {
		return "3D controller"
	}
	return "Display controller"
}
