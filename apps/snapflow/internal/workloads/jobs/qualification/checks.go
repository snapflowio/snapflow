// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package qualification

import (
	"bytes"
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"os"
)

const (
	workDirectoryMode       = 0o700
	storageSamplePattern    = ".qualification-*"
	storageSampleFill       = 0xA5
	storageSampleBlockBytes = 64 * 1024
	cpuIterationsMetric     = "cpuIterations"
	diskSampleBytesMetric   = "diskSampleBytes"
)

func executeCheck(ctx context.Context, cfg Config, request Request, checkID string, metrics map[string]int) error {
	switch checkID {
	case checkRuntimeHealth:
		return checkRuntime(ctx, cfg)
	case checkStorageIO:
		return sampleStorage(ctx, cfg.WorkDirectory, request.WorkLimits.DiskSampleBytes, metrics)
	case checkCPUBoundedWork:
		return boundedCPUWork(ctx, request, metrics)
	case checkMachineIdentity:
		return cfg.Identity.Validate()
	case checkCanaryMicroVM:
		return RunCanaryMicroVM(ctx, cfg, request)
	default:
		return fmt.Errorf("unsupported machine qualification check %q", checkID)
	}
}

func checkRuntime(ctx context.Context, cfg Config) error {
	for _, health := range cfg.Runtime.Health(ctx) {
		if !health.Healthy {
			if health.Error != nil {
				return fmt.Errorf("runtime service %s is unhealthy: %w", health.Name, health.Error)
			}
			return fmt.Errorf("runtime service %s is unhealthy", health.Name)
		}
	}
	capabilities, err := cfg.Runtime.Capabilities(ctx)
	if err != nil {
		return fmt.Errorf("inspect runtime capabilities: %w", err)
	}
	if !capabilities.KVMAvailable {
		return errors.New("the runtime reports KVM as unavailable")
	}
	if capabilities.MachineReleaseDigest != cfg.ReleaseDigest {
		return fmt.Errorf("the runtime serves release %s, but the session was qualified for %s",
			capabilities.MachineReleaseDigest, cfg.ReleaseDigest)
	}
	return nil
}

type checkGuidance struct {
	requirement string
	fix         string
}

func guidance(checkID string) checkGuidance {
	known := map[string]checkGuidance{
		checkRuntimeHealth: {
			requirement: "every microVM runtime service is healthy and KVM is available",
			fix:         "run `sudo snapflow doctor` and fix each failed check",
		},
		checkStorageIO: {
			requirement: "the runtime data directory accepts a write and read-back sample",
			fix:         "check free space and disk health of the runtime data directory with `sudo snapflow doctor`",
		},
		checkCPUBoundedWork: {
			requirement: "a fixed CPU workload finishes inside the qualification time limit",
			fix:         "stop other heavy workloads on this machine, then retry the benchmark in the dashboard",
		},
		checkMachineIdentity: {
			requirement: "this machine's stored identity key is valid",
			fix:         "remove the machine in the dashboard, then enroll it again with a new key",
		},
		checkCanaryMicroVM: {
			requirement: "a canary microVM boots and returns its secret",
			fix:         "run `sudo snapflow doctor` and read `journalctl -u snapflow` around this message for the microVM error",
		},
	}
	return known[checkID]
}

func boundedCPUWork(ctx context.Context, request Request, metrics map[string]int) error {
	value := []byte(request.Nonce)
	for iteration := 0; iteration < request.WorkLimits.CPUIterations; iteration++ {
		if err := ctx.Err(); err != nil {
			return err
		}
		digest := sha256.Sum256(value)
		value = digest[:]
	}
	metrics[cpuIterationsMetric] = request.WorkLimits.CPUIterations
	return nil
}

func sampleStorage(ctx context.Context, directory string, size int64, metrics map[string]int) (resultErr error) {
	if err := os.MkdirAll(directory, workDirectoryMode); err != nil {
		return fmt.Errorf("prepare machine qualification storage: %w", err)
	}
	file, err := os.CreateTemp(directory, storageSamplePattern)
	if err != nil {
		return fmt.Errorf("create machine qualification storage sample: %w", err)
	}
	path := file.Name()
	defer func() {
		if closeErr := file.Close(); closeErr != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("close machine qualification storage sample: %w", closeErr))
		}
		if removeErr := os.Remove(path); removeErr != nil && !errors.Is(removeErr, os.ErrNotExist) {
			resultErr = errors.Join(resultErr, fmt.Errorf("remove machine qualification storage sample: %w", removeErr))
		}
	}()
	if err := writeStorageSample(ctx, file, size); err != nil {
		return err
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return fmt.Errorf("rewind machine qualification storage sample: %w", err)
	}
	read, err := io.Copy(io.Discard, io.LimitReader(file, size))
	if err != nil {
		return fmt.Errorf("read machine qualification storage sample: read %d of %d bytes: %w", read, size, err)
	}
	if read != size {
		return fmt.Errorf("read machine qualification storage sample: read %d of %d bytes", read, size)
	}
	metrics[diskSampleBytesMetric] = int(size)
	return nil
}

func writeStorageSample(ctx context.Context, file *os.File, size int64) error {
	block := bytes.Repeat([]byte{storageSampleFill}, storageSampleBlockBytes)
	remaining := size
	for remaining > 0 {
		if err := ctx.Err(); err != nil {
			return err
		}
		chunk := min(int64(len(block)), remaining)
		if _, err := file.Write(block[:chunk]); err != nil {
			return fmt.Errorf("write machine qualification storage sample: %w", err)
		}
		remaining -= chunk
	}
	if err := file.Sync(); err != nil {
		return fmt.Errorf("sync machine qualification storage sample: %w", err)
	}
	return nil
}
