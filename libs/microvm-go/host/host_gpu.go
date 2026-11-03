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

package host

import (
	"context"
	"fmt"
	"log/slog"
	"os/exec"
	"slices"
	"strconv"
	"strings"
	"time"
)

const (
	gpuDetectionTimeout  = 5 * time.Second
	gpuQueryColumns      = 9
	mebibytesPerGibibyte = 1024
	pciDomainLength      = 4
)

type HostGPUDevice struct {
	Index             int
	UUID              string
	PCIAddress        string
	PCIDeviceID       string
	PCISubsystemID    string
	Name              string
	Vendor            string
	Model             string
	VramGiB           float64
	DriverVersion     string
	ComputeCapability string
}

type HostGPUInfo struct {
	Count        int
	Type         string
	Devices      []HostGPUDevice
	TotalVramGiB float64
}

func DetectHostGPUs(ctx context.Context) HostGPUInfo {
	detectCtx, cancel := context.WithTimeout(ctx, gpuDetectionTimeout)
	defer cancel()

	cmd := exec.CommandContext(
		detectCtx,
		"nvidia-smi",
		"--query-gpu=index,uuid,pci.bus_id,name,memory.total,driver_version,pci.device_id,pci.sub_device_id,compute_cap",
		"--format=csv,noheader,nounits",
	)
	output, err := cmd.Output()
	if err != nil {
		slog.Info("no NVIDIA GPUs detected", "error", err)
		return HostGPUInfo{}
	}

	devices := make([]HostGPUDevice, 0)
	uniqueNames := make([]string, 0)
	for _, line := range strings.Split(string(output), "\n") {
		device, err := parseHostGPUDevice(line)
		if err != nil {
			slog.Debug("skipping unparseable GPU row", "row", line, "error", err)
			continue
		}
		name := normalizeGPUName(device.Name)
		if name == "" {
			continue
		}
		device.Name = name
		device.Vendor, device.Model = splitGPUVendorModel(name)
		devices = append(devices, device)
		if !slices.Contains(uniqueNames, name) {
			uniqueNames = append(uniqueNames, name)
		}
	}

	if len(devices) == 0 {
		return HostGPUInfo{}
	}

	gpuType := uniqueNames[0]
	if len(uniqueNames) > 1 {
		gpuType = strings.Join(uniqueNames, ", ")
	}

	var totalVramGiB float64
	for _, device := range devices {
		totalVramGiB += device.VramGiB
	}

	return HostGPUInfo{
		Count:        len(devices),
		Type:         gpuType,
		Devices:      devices,
		TotalVramGiB: totalVramGiB,
	}
}

func parseHostGPUDevice(line string) (HostGPUDevice, error) {
	line = strings.TrimSpace(line)
	if line == "" {
		return HostGPUDevice{}, fmt.Errorf("empty GPU row")
	}

	parts := strings.Split(line, ",")
	if len(parts) < gpuQueryColumns {
		return HostGPUDevice{}, fmt.Errorf("expected %d columns, got %d", gpuQueryColumns, len(parts))
	}

	index, err := strconv.Atoi(strings.TrimSpace(parts[0]))
	if err != nil {
		return HostGPUDevice{}, fmt.Errorf("parse GPU index: %w", err)
	}

	memoryMiB, err := strconv.ParseFloat(strings.TrimSpace(parts[4]), 64)
	if err != nil {
		memoryMiB = 0
	}

	return HostGPUDevice{
		Index:             index,
		UUID:              strings.TrimSpace(parts[1]),
		PCIAddress:        normalizePCIBusID(parts[2]),
		Name:              strings.TrimSpace(parts[3]),
		VramGiB:           memoryMiB / mebibytesPerGibibyte,
		DriverVersion:     strings.TrimSpace(parts[5]),
		PCIDeviceID:       strings.TrimSpace(parts[6]),
		PCISubsystemID:    strings.TrimSpace(parts[7]),
		ComputeCapability: strings.TrimSpace(parts[8]),
	}, nil
}

func normalizePCIBusID(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	domain, address, found := strings.Cut(value, ":")
	if !found {
		return value
	}
	if len(domain) > pciDomainLength {
		domain = domain[len(domain)-pciDomainLength:]
	}
	return domain + ":" + address
}

func normalizeGPUName(value string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
}

func splitGPUVendorModel(name string) (string, string) {
	fields := strings.Fields(name)
	if len(fields) == 0 {
		return "", ""
	}

	switch strings.ToLower(fields[0]) {
	case "nvidia", "amd", "intel":
		return fields[0], strings.Join(fields[1:], " ")
	default:
		return "", name
	}
}

// CheckGPUHealth asks the NVIDIA driver to initialize and report the GPU at
// pciAddress, which fails for a device that did not come back from a reset.
func CheckGPUHealth(ctx context.Context, pciAddress string) error {
	checkCtx, cancel := context.WithTimeout(ctx, gpuDetectionTimeout)
	defer cancel()
	want := normalizePCIBusID(pciAddress)
	output, err := exec.CommandContext(checkCtx, "nvidia-smi", "--id="+want,
		"--query-gpu=pci.bus_id", "--format=csv,noheader").CombinedOutput()
	if err != nil {
		return fmt.Errorf("nvidia-smi health check for %s: %w: %s", want, err, strings.TrimSpace(string(output)))
	}
	if reported := normalizePCIBusID(string(output)); reported != want {
		return fmt.Errorf("nvidia-smi reported GPU %q for %s", reported, want)
	}
	return nil
}
