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

package control

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"golang.org/x/sys/unix"
)

const (
	meminfoValueField        = 1
	netDevTransmitBytesField = 8
	gpuTelemetryColumns      = 3
	gpuTelemetryTimeout      = 2 * time.Second
	bytesPerMiB              = 1024 * 1024
)

const bytesPerKiB = 1024

func collectTelemetry(ctx context.Context) (TelemetrySnapshot, error) {
	bootIDBytes, err := os.ReadFile("/proc/sys/kernel/random/boot_id")
	if err != nil {
		return TelemetrySnapshot{}, fmt.Errorf("read guest boot ID: %w", err)
	}
	bootID := strings.TrimSpace(string(bootIDBytes))
	if bootID == "" {
		return TelemetrySnapshot{}, fmt.Errorf("guest boot ID is empty")
	}
	totalTicks, busyTicks, err := readCPUTicks("/proc/stat")
	if err != nil {
		return TelemetrySnapshot{}, err
	}
	memoryTotal, memoryUsed, err := readMemoryBytes("/proc/meminfo")
	if err != nil {
		return TelemetrySnapshot{}, err
	}
	storageTotal, storageUsed, err := readFilesystemBytes("/")
	if err != nil {
		return TelemetrySnapshot{}, err
	}
	receiveBytes, transmitBytes, err := readNetworkBytes("/proc/net/dev")
	if err != nil {
		return TelemetrySnapshot{}, err
	}
	snapshot := TelemetrySnapshot{
		BootID:               bootID,
		CPUTotalTicks:        totalTicks,
		CPUBusyTicks:         busyTicks,
		MemoryTotalBytes:     memoryTotal,
		MemoryUsedBytes:      memoryUsed,
		StorageTotalBytes:    storageTotal,
		StorageUsedBytes:     storageUsed,
		NetworkReceiveBytes:  receiveBytes,
		NetworkTransmitBytes: transmitBytes,
	}
	readGPUTelemetry(ctx, &snapshot)
	return snapshot, nil
}

func readCPUTicks(path string) (uint64, uint64, error) {
	file, err := os.Open(path)
	if err != nil {
		return 0, 0, fmt.Errorf("open CPU counters: %w", err)
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	if !scanner.Scan() {
		return 0, 0, fmt.Errorf("read CPU counters: %w", scanner.Err())
	}
	fields := strings.Fields(scanner.Text())
	if len(fields) < 5 || fields[0] != "cpu" {
		return 0, 0, fmt.Errorf("aggregate CPU counters are malformed")
	}
	var total uint64
	var idle uint64
	for index, field := range fields[1:] {
		value, err := strconv.ParseUint(field, 10, 64)
		if err != nil {
			return 0, 0, fmt.Errorf("parse CPU counter %d: %w", index, err)
		}
		total += value
		if index == 3 || index == 4 {
			idle += value
		}
	}
	if idle > total {
		return 0, 0, fmt.Errorf("aggregate CPU idle counter exceeds total")
	}
	return total, total - idle, nil
}

func readMemoryBytes(path string) (uint64, uint64, error) {
	file, err := os.Open(path)
	if err != nil {
		return 0, 0, fmt.Errorf("open memory counters: %w", err)
	}
	defer file.Close()
	var total uint64
	var available uint64
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) <= meminfoValueField {
			continue
		}
		value, parseErr := strconv.ParseUint(fields[meminfoValueField], 10, 64)
		if parseErr != nil {
			return 0, 0, fmt.Errorf("parse memory counter %s: %w", fields[0], parseErr)
		}
		switch fields[0] {
		case "MemTotal:":
			total = value * bytesPerKiB
		case "MemAvailable:":
			available = value * bytesPerKiB
		}
	}
	if err := scanner.Err(); err != nil {
		return 0, 0, fmt.Errorf("read memory counters: %w", err)
	}
	if total == 0 || available > total {
		return 0, 0, fmt.Errorf("memory counters are incomplete")
	}
	return total, total - available, nil
}

func readFilesystemBytes(path string) (uint64, uint64, error) {
	var stats unix.Statfs_t
	if err := unix.Statfs(path, &stats); err != nil {
		return 0, 0, fmt.Errorf("stat workload filesystem: %w", err)
	}
	total := stats.Blocks * uint64(stats.Bsize)
	available := stats.Bavail * uint64(stats.Bsize)
	if available > total {
		return 0, 0, fmt.Errorf("filesystem available bytes exceed total")
	}
	return total, total - available, nil
}

func readNetworkBytes(path string) (uint64, uint64, error) {
	file, err := os.Open(path)
	if err != nil {
		return 0, 0, fmt.Errorf("open network counters: %w", err)
	}
	defer file.Close()
	var receive uint64
	var transmit uint64
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		interfaceName, counters, found := strings.Cut(line, ":")
		if !found {
			continue
		}
		name := strings.TrimSpace(interfaceName)
		if name == "lo" {
			continue
		}
		fields := strings.Fields(counters)
		if len(fields) <= netDevTransmitBytesField {
			return 0, 0, fmt.Errorf("network counters for %s are malformed", name)
		}
		rx, err := strconv.ParseUint(fields[0], 10, 64)
		if err != nil {
			return 0, 0, fmt.Errorf("parse receive counter for %s: %w", name, err)
		}
		tx, err := strconv.ParseUint(fields[netDevTransmitBytesField], 10, 64)
		if err != nil {
			return 0, 0, fmt.Errorf("parse transmit counter for %s: %w", name, err)
		}
		receive += rx
		transmit += tx
	}
	if err := scanner.Err(); err != nil {
		return 0, 0, fmt.Errorf("read network counters: %w", err)
	}
	return receive, transmit, nil
}

func readGPUTelemetry(ctx context.Context, snapshot *TelemetrySnapshot) {
	path, err := exec.LookPath("nvidia-smi")
	if err != nil {
		return
	}
	commandCtx, cancel := context.WithTimeout(ctx, gpuTelemetryTimeout)
	defer cancel()
	output, err := exec.CommandContext(
		commandCtx,
		path,
		"--query-gpu=utilization.gpu,memory.used,memory.total",
		"--format=csv,noheader,nounits",
	).Output()
	if err != nil {
		return
	}
	var utilizationTotal float64
	var memoryUsedMiB uint64
	var memoryTotalMiB uint64
	var count uint64
	for _, line := range strings.Split(strings.TrimSpace(string(output)), "\n") {
		fields := strings.Split(line, ",")
		if len(fields) != gpuTelemetryColumns {
			return
		}
		utilization, err := strconv.ParseFloat(strings.TrimSpace(fields[0]), 64)
		if err != nil {
			return
		}
		used, err := strconv.ParseUint(strings.TrimSpace(fields[1]), 10, 64)
		if err != nil {
			return
		}
		total, err := strconv.ParseUint(strings.TrimSpace(fields[2]), 10, 64)
		if err != nil {
			return
		}
		utilizationTotal += utilization
		memoryUsedMiB += used
		memoryTotalMiB += total
		count++
	}
	if count == 0 {
		return
	}
	utilization := utilizationTotal / float64(count)
	memoryUsed := memoryUsedMiB * bytesPerMiB
	memoryTotal := memoryTotalMiB * bytesPerMiB
	snapshot.GPUUtilizationPercent = &utilization
	snapshot.GPUMemoryUsedBytes = &memoryUsed
	snapshot.GPUMemoryTotalBytes = &memoryTotal
}
