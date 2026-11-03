// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

//go:build linux

package suite

import (
	"bufio"
	"errors"
	"fmt"
	"net/http"
	"os"
	"runtime"
	"runtime/debug"
	"strconv"
	"strings"
	"time"

	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"golang.org/x/sys/unix"
)

const (
	defaultSpeedtestStreams = 8
	defaultSpeedtestTime    = 15 * time.Second
	defaultGPUHelper        = "gpu-gemm"
	memoryReserveBytes      = 128 * mebibyte
	diskReserveBytes        = gibibyte
	diskWorkingSetBytes     = 4 * gibibyte
	vramReserveBytes        = gibibyte
	systemRoot              = "/"
	memoryInfoPath          = "/proc/meminfo"
	memoryAvailableField    = "MemAvailable:"
)

func DefaultPlan(profile machinev1alpha1.BenchmarkProfile, diskDirectory string) (Plan, error) {
	timing, err := timingFor(profile)
	if err != nil {
		return Plan{}, err
	}
	memory, err := availableMemory()
	if err != nil {
		return Plan{}, err
	}
	disk, err := availableDisk(diskDirectory)
	if err != nil {
		return Plan{}, err
	}
	if memory <= memoryReserveBytes || disk <= diskReserveBytes {
		return Plan{}, errors.New("the guest has too little free memory or disk to benchmark")
	}
	return Plan{
		CPUThreads:        runtime.NumCPU(),
		CPU:               timing.cpu,
		MemoryBytes:       memory - memoryReserveBytes,
		MemoryTouchPasses: timing.touchPasses,
		DiskDirectory:     diskDirectory,
		DiskBytes:         min(disk-diskReserveBytes, diskWorkingSetBytes),
		DiskTiming:        timing.disk,
		SpeedtestStreams:  defaultSpeedtestStreams,
		SpeedtestDuration: defaultSpeedtestTime,
		HTTPClient:        separateConnectionClient(),
		GPU: GPUConfig{
			System: os.DirFS(systemRoot), Helper: defaultGPUHelper, VRAMReserveBytes: vramReserveBytes,
			GEMMDimension: GEMMDimension, GEMM: timing.gemm,
		},
	}, nil
}

// memoryBudget caps the memory fill by what the guest has free right now: the CPU
// phases' heap goes back to the kernel first, so the fill cannot exhaust the guest.
func memoryBudget(limit uint64) (uint64, error) {
	debug.FreeOSMemory()
	available, err := availableMemory()
	if err != nil {
		return 0, err
	}
	if available <= memoryReserveBytes {
		return 0, errors.New("the guest has too little free memory to benchmark")
	}
	return min(limit, available-memoryReserveBytes), nil
}

func availableMemory() (bytes uint64, resultErr error) {
	file, err := os.Open(memoryInfoPath)
	if err != nil {
		return 0, fmt.Errorf("open %s: %w", memoryInfoPath, err)
	}
	defer func() {
		if closeErr := file.Close(); closeErr != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("close %s: %w", memoryInfoPath, closeErr))
		}
	}()
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 2 || fields[0] != memoryAvailableField {
			continue
		}
		kilobytes, err := strconv.ParseUint(fields[1], 10, 64)
		if err != nil {
			return 0, fmt.Errorf("parse available memory: %w", err)
		}
		return kilobytes * kibibyte, nil
	}
	if err := scanner.Err(); err != nil {
		return 0, fmt.Errorf("read %s: %w", memoryInfoPath, err)
	}
	return 0, errors.New("the kernel does not report available memory")
}

func availableDisk(directory string) (uint64, error) {
	var stats unix.Statfs_t
	if err := unix.Statfs(directory, &stats); err != nil {
		return 0, fmt.Errorf("inspect free disk space in %s: %w", directory, err)
	}
	return stats.Bfree * uint64(stats.Bsize), nil
}

func separateConnectionClient() *http.Client {
	protocols := new(http.Protocols)
	protocols.SetHTTP1(true)
	return &http.Client{Transport: &http.Transport{Protocols: protocols}}
}
