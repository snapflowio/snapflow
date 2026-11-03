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

package devices

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"time"

	"github.com/ebitengine/purego"
)

const (
	scrubArgument      = "snapflow-gpu-scrub"
	scrubSelfExecPath  = "/proc/self/exe"
	scrubTimeout       = 5 * time.Minute
	scrubFailureExit   = 125
	cudaLibrary        = "libcuda.so.1"
	cudaSuccess        = 0
	cudaOutOfMemory    = 2
	scrubLargestChunk  = 1 << 30
	scrubSmallestChunk = 2 << 20
	// scrubCoverageSlack is how much of the memory free before the scrub may
	// stay unallocated (allocator rounding and driver bookkeeping) before the
	// scrub counts as incomplete.
	scrubCoverageSlack = 256 << 20
)

// scrubReport is what the scrub subprocess prints on success.
type scrubReport struct {
	FreeBytes     uint64 `json:"freeBytes"`
	ScrubbedBytes uint64 `json:"scrubbedBytes"`
}

// Init runs the VRAM scrub when this process was started for one, and
// returns immediately otherwise. Call it first in main of every binary that
// releases passthrough GPUs; a scrub process never returns from it.
func Init() {
	if len(os.Args) != 2 || os.Args[0] != scrubArgument {
		return
	}
	// A CUDA context is current on one OS thread.
	runtime.LockOSThread()
	report, err := scrub(os.Args[1])
	if err == nil {
		err = json.NewEncoder(os.Stdout).Encode(report)
	}
	if err != nil {
		fmt.Fprintf(os.Stderr, "snapflow gpu scrub: %v\n", err)
		os.Exit(scrubFailureExit)
	}
	os.Exit(0)
}

// scrubGPU zeroes every byte of VRAM the driver will hand out on the GPU at
// pciAddress. Function-level reset is not assumed to clear VRAM, so this runs
// before a GPU is offered to the next tenant. It runs in a child process that
// is killed if the device hangs.
func scrubGPU(ctx context.Context, pciAddress string) error {
	scrubCtx, cancel := context.WithTimeout(ctx, scrubTimeout)
	defer cancel()
	command := exec.CommandContext(scrubCtx, scrubSelfExecPath, pciAddress)
	command.Args[0] = scrubArgument
	var stdout, stderr bytes.Buffer
	command.Stdout, command.Stderr = &stdout, &stderr
	if err := command.Run(); err != nil {
		return fmt.Errorf("scrub GPU %s memory: %w: %s", pciAddress, err, bytes.TrimSpace(stderr.Bytes()))
	}
	var report scrubReport
	if err := json.Unmarshal(stdout.Bytes(), &report); err != nil {
		return fmt.Errorf("decode GPU %s scrub report: %w", pciAddress, err)
	}
	if report.ScrubbedBytes+scrubCoverageSlack < report.FreeBytes {
		return fmt.Errorf("scrubbed %d of %d free bytes on GPU %s", report.ScrubbedBytes, report.FreeBytes, pciAddress)
	}
	return nil
}

// cudaDriver is the slice of the CUDA driver API the scrub needs. It ships
// with the NVIDIA driver, so hosts need no CUDA toolkit.
type cudaDriver struct {
	init              func(flags uint32) int32
	deviceByPCIBusID  func(device *int32, busID string) int32
	primaryCtxRetain  func(cudaContext *uintptr, device int32) int32
	primaryCtxRelease func(device int32) int32
	ctxSetCurrent     func(cudaContext uintptr) int32
	ctxSynchronize    func() int32
	memGetInfo        func(free, total *uintptr) int32
	memAlloc          func(pointer *uint64, size uintptr) int32
	memsetD8          func(pointer uint64, value uint8, count uintptr) int32
}

func loadCUDA() (cudaDriver, error) {
	library, err := purego.Dlopen(cudaLibrary, purego.RTLD_NOW|purego.RTLD_LOCAL)
	if err != nil {
		return cudaDriver{}, fmt.Errorf("load %s: %w", cudaLibrary, err)
	}
	var driver cudaDriver
	symbols := []struct {
		name     string
		function any
	}{
		{"cuInit", &driver.init},
		{"cuDeviceGetByPCIBusId", &driver.deviceByPCIBusID},
		{"cuDevicePrimaryCtxRetain", &driver.primaryCtxRetain},
		{"cuDevicePrimaryCtxRelease_v2", &driver.primaryCtxRelease},
		{"cuCtxSetCurrent", &driver.ctxSetCurrent},
		{"cuCtxSynchronize", &driver.ctxSynchronize},
		{"cuMemGetInfo_v2", &driver.memGetInfo},
		{"cuMemAlloc_v2", &driver.memAlloc},
		{"cuMemsetD8_v2", &driver.memsetD8},
	}
	for _, symbol := range symbols {
		address, err := purego.Dlsym(library, symbol.name)
		if err != nil {
			return cudaDriver{}, fmt.Errorf("resolve %s: %w", symbol.name, err)
		}
		purego.RegisterFunc(symbol.function, address)
	}
	return driver, nil
}

func cudaCall(name string, result int32) error {
	if result != cudaSuccess {
		return fmt.Errorf("%s failed with CUDA error %d", name, result)
	}
	return nil
}

func scrub(pciAddress string) (scrubReport, error) {
	driver, err := loadCUDA()
	if err != nil {
		return scrubReport{}, err
	}
	if err := cudaCall("cuInit", driver.init(0)); err != nil {
		return scrubReport{}, err
	}
	var device int32
	if err := cudaCall("cuDeviceGetByPCIBusId", driver.deviceByPCIBusID(&device, pciAddress)); err != nil {
		return scrubReport{}, err
	}
	var cudaContext uintptr
	if err := cudaCall("cuDevicePrimaryCtxRetain", driver.primaryCtxRetain(&cudaContext, device)); err != nil {
		return scrubReport{}, err
	}
	report, err := scrubContext(driver, cudaContext)
	if releaseErr := cudaCall("cuDevicePrimaryCtxRelease", driver.primaryCtxRelease(device)); err == nil {
		err = releaseErr
	}
	return report, err
}

// scrubContext allocates all free VRAM in shrinking chunks and zeroes each
// chunk. Releasing the primary context frees the allocations.
func scrubContext(driver cudaDriver, cudaContext uintptr) (scrubReport, error) {
	if err := cudaCall("cuCtxSetCurrent", driver.ctxSetCurrent(cudaContext)); err != nil {
		return scrubReport{}, err
	}
	var free, total uintptr
	if err := cudaCall("cuMemGetInfo", driver.memGetInfo(&free, &total)); err != nil {
		return scrubReport{}, err
	}
	report := scrubReport{FreeBytes: uint64(free)}
	for chunk := uintptr(scrubLargestChunk); chunk >= scrubSmallestChunk; {
		var pointer uint64
		result := driver.memAlloc(&pointer, chunk)
		if result == cudaOutOfMemory {
			chunk /= 2
			continue
		}
		if err := cudaCall("cuMemAlloc", result); err != nil {
			return report, err
		}
		if err := cudaCall("cuMemsetD8", driver.memsetD8(pointer, 0, chunk)); err != nil {
			return report, err
		}
		report.ScrubbedBytes += uint64(chunk)
	}
	return report, cudaCall("cuCtxSynchronize", driver.ctxSynchronize())
}
