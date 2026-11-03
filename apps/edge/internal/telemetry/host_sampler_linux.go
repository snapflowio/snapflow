// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

//go:build linux

package telemetry

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	cpuStatPath            = "/proc/stat"
	memoryInfoPath         = "/proc/meminfo"
	aggregateCPULabel      = "cpu"
	memoryTotalLabel       = "MemTotal:"
	memoryAvailableLabel   = "MemAvailable:"
	bytesPerKiB            = 1024
	loadDecayCurrentWeight = 0.25
	cpuStatMinimumFields   = 6
	cpuIdleCounter         = 3
	cpuIOWaitCounter       = 4
	memoryInfoMinFields    = 2
	memoryInfoValueField   = 1
)

type hostCounters struct {
	observedAt time.Time
	cpuTotal   uint64
	cpuIdle    uint64
	network    networkCounters
}

type HostSampler struct {
	mu                sync.Mutex
	networkInterfaces map[string]struct{}
	previous          hostCounters
	smoothed          HostSample
}

func NewHostSampler() (*HostSampler, error) {
	networkInterfaces, err := resolveNetworkInterfaces()
	if err != nil {
		return nil, err
	}
	if _, err := readNetwork(networkInterfaces); err != nil {
		return nil, err
	}
	return &HostSampler{networkInterfaces: networkInterfaces}, nil
}

func (sampler *HostSampler) Sample() (HostSample, error) {
	current, memoryUtilization, err := readHostCounters(
		sampler.networkInterfaces,
	)
	if err != nil {
		return HostSample{}, err
	}
	sampler.mu.Lock()
	defer sampler.mu.Unlock()
	previous := sampler.previous
	sampler.previous = current
	result := HostSample{MemoryUtilization: memoryUtilization}
	if previous.observedAt.IsZero() {
		sampler.smoothed = result
		return result, nil
	}
	elapsed := current.observedAt.Sub(previous.observedAt).Seconds()
	if elapsed <= 0 {
		return HostSample{}, errors.New("host metric sample interval is invalid")
	}
	if current.cpuTotal > previous.cpuTotal && current.cpuIdle >= previous.cpuIdle {
		totalDelta := current.cpuTotal - previous.cpuTotal
		idleDelta := current.cpuIdle - previous.cpuIdle
		result.CPUUtilization = float32(
			1 - float64(idleDelta)/float64(totalDelta),
		)
	}
	result.PacketDrops = rate(current.network.drops, previous.network.drops, elapsed)
	result.BytesPerSecondIn = retainLoad(
		sampler.smoothed.BytesPerSecondIn,
		rate(current.network.bytesIn, previous.network.bytesIn, elapsed),
	)
	result.BytesPerSecondOut = retainLoad(
		sampler.smoothed.BytesPerSecondOut,
		rate(current.network.bytesOut, previous.network.bytesOut, elapsed),
	)
	result.PacketsPerSecond = retainLoad(
		sampler.smoothed.PacketsPerSecond,
		rate(current.network.packets, previous.network.packets, elapsed),
	)
	result.CPUUtilization = retainUtilization(
		sampler.smoothed.CPUUtilization,
		result.CPUUtilization,
	)
	result.MemoryUtilization = retainUtilization(
		sampler.smoothed.MemoryUtilization,
		result.MemoryUtilization,
	)
	sampler.smoothed = result
	return result, nil
}

func readHostCounters(
	networkInterfaces map[string]struct{},
) (hostCounters, float32, error) {
	cpuTotal, cpuIdle, err := readCPU()
	if err != nil {
		return hostCounters{}, 0, err
	}
	totalMemory, availableMemory, err := readMemory()
	if err != nil {
		return hostCounters{}, 0, err
	}
	network, err := readNetwork(networkInterfaces)
	if err != nil {
		return hostCounters{}, 0, err
	}
	return hostCounters{
		observedAt: time.Now(),
		cpuTotal:   cpuTotal,
		cpuIdle:    cpuIdle,
		network:    network,
	}, float32(
		float64(totalMemory-availableMemory) / float64(totalMemory),
	), nil
}

func readCPU() (uint64, uint64, error) {
	data, err := os.ReadFile(cpuStatPath)
	if err != nil {
		return 0, 0, fmt.Errorf("read %s: %w", cpuStatPath, err)
	}
	scanner := bufio.NewScanner(strings.NewReader(string(data)))
	if !scanner.Scan() {
		return 0, 0, errors.New("read aggregate CPU counters")
	}
	fields := strings.Fields(scanner.Text())
	if len(fields) < cpuStatMinimumFields || fields[0] != aggregateCPULabel {
		return 0, 0, errors.New("invalid aggregate CPU counters")
	}
	values := make([]uint64, 0, len(fields)-1)
	for index, field := range fields[1:] {
		value, err := strconv.ParseUint(field, decimalBase, counterBits)
		if err != nil {
			return 0, 0, fmt.Errorf("parse CPU counter %d: %w", index, err)
		}
		values = append(values, value)
	}
	var total uint64
	for _, value := range values {
		total += value
	}
	return total, values[cpuIdleCounter] + values[cpuIOWaitCounter], scanner.Err()
}

func readMemory() (uint64, uint64, error) {
	data, err := os.ReadFile(memoryInfoPath)
	if err != nil {
		return 0, 0, fmt.Errorf("read %s: %w", memoryInfoPath, err)
	}
	var total, available uint64
	scanner := bufio.NewScanner(strings.NewReader(string(data)))
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < memoryInfoMinFields {
			continue
		}
		switch fields[0] {
		case memoryTotalLabel:
			total, err = strconv.ParseUint(fields[memoryInfoValueField], decimalBase, counterBits)
		case memoryAvailableLabel:
			available, err = strconv.ParseUint(fields[memoryInfoValueField], decimalBase, counterBits)
		}
		if err != nil {
			return 0, 0, fmt.Errorf("parse host memory: %w", err)
		}
	}
	if err := scanner.Err(); err != nil {
		return 0, 0, fmt.Errorf("scan %s: %w", memoryInfoPath, err)
	}
	total *= bytesPerKiB
	available *= bytesPerKiB
	if total == 0 || available > total {
		return 0, 0, errors.New("invalid host memory counters")
	}
	return total, available, nil
}

func rate(current, previous uint64, elapsed float64) int64 {
	if current < previous {
		return 0
	}
	return int64(float64(current-previous) / elapsed)
}

func retainLoad(previous, current int64) int64 {
	if current >= previous {
		return current
	}
	return int64(
		float64(previous)*(1-loadDecayCurrentWeight) +
			float64(current)*loadDecayCurrentWeight,
	)
}

func retainUtilization(previous, current float32) float32 {
	if current >= previous {
		return current
	}
	return previous*(1-loadDecayCurrentWeight) +
		current*loadDecayCurrentWeight
}
