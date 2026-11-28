// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the license at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

//go:build linux

package jail

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"

	systemd "github.com/coreos/go-systemd/v22/dbus"
	godbus "github.com/godbus/dbus/v5"
)

const (
	Slice = "snapflow-vms.slice"

	scopePrefix          = "snapflow-vm-"
	scopeSuffix          = ".scope"
	scopeJobMode         = "fail"
	scopeStopMode        = "replace"
	scopeJobDone         = "done"
	procRoot             = "/proc"
	cgroupFile           = "cgroup"
	unifiedCgroupPrefix  = "0::"
	cpuQuotaUnitPerCPU   = uint64(1_000_000)
	collectInactiveUnits = "inactive-or-failed"
)

func ScopeName(id string) string {
	return scopePrefix + id + scopeSuffix
}

func Place(ctx context.Context, id string, pid int, limits Limits) error {
	connection, err := systemd.NewSystemConnectionContext(ctx)
	if err != nil {
		return fmt.Errorf("connect to systemd: %w", err)
	}
	defer connection.Close()
	properties := []systemd.Property{
		systemd.PropDescription("Snapflow microVM " + id),
		systemd.PropSlice(Slice),
		systemd.PropPids(uint32(pid)),
		property("CollectMode", collectInactiveUnits),
		property("MemorySwapMax", uint64(0)),
	}
	if limits.CPUs > 0 {
		pinning.Lock()
		defer pinning.Unlock()
		cpus, err := wholeCores(ctx, connection, limits.CPUs)
		if err != nil {
			return fmt.Errorf("pin microVM %s: %w", id, err)
		}
		properties = append(
			properties,
			property("CPUQuotaPerSecUSec", uint64(limits.CPUs)*cpuQuotaUnitPerCPU),
			property(allowedCPUsProperty, cpuMask(cpus)),
		)
	}
	if limits.CPUWeight > 0 {
		properties = append(properties, property("CPUWeight", limits.CPUWeight))
	}
	if limits.MemoryBytes > 0 {
		properties = append(properties, property("MemoryMax", limits.MemoryBytes))
	}
	if limits.MemoryThrottleBytes > 0 {
		properties = append(properties, property("MemoryHigh", limits.MemoryThrottleBytes))
	}
	if limits.Tasks > 0 {
		properties = append(properties, property("TasksMax", limits.Tasks))
	}
	properties = append(properties, diskLimits(limits)...)
	result := make(chan string, 1)
	if _, err := connection.StartTransientUnitContext(ctx, ScopeName(id), scopeJobMode, properties, result); err != nil {
		return fmt.Errorf("create scope for microVM %s: %w", id, err)
	}
	if err := awaitJob(ctx, result); err != nil {
		return fmt.Errorf("create scope for microVM %s: %w", id, err)
	}
	return confirmPlaced(ctx, connection, id, pid)
}

func confirmPlaced(ctx context.Context, connection *systemd.Conn, id string, pid int) error {
	cgroup, err := processCgroup(pid)
	if err == nil && path.Base(cgroup) == ScopeName(id) {
		return nil
	}
	if err == nil {
		err = fmt.Errorf("process %d is in %s", pid, cgroup)
	}
	placeErr := fmt.Errorf("place microVM %s in its scope: %w", id, err)
	if stopErr := stopScope(ctx, connection, ScopeName(id)); stopErr != nil {
		return errors.Join(placeErr, stopErr)
	}
	return placeErr
}

func stopScope(ctx context.Context, connection *systemd.Conn, unit string) error {
	result := make(chan string, 1)
	if _, err := connection.StopUnitContext(ctx, unit, scopeStopMode, result); err != nil {
		return fmt.Errorf("stop the empty scope %s: %w", unit, err)
	}
	if err := awaitJob(ctx, result); err != nil {
		return fmt.Errorf("stop the empty scope %s: %w", unit, err)
	}
	return nil
}

func ProcessInScope(pid int, id string) (bool, error) {
	cgroup, err := processCgroup(pid)
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return path.Base(cgroup) == ScopeName(id), nil
}

func processCgroup(pid int) (string, error) {
	data, err := os.ReadFile(filepath.Join(procRoot, strconv.Itoa(pid), cgroupFile))
	if err != nil {
		return "", fmt.Errorf("read the cgroup of process %d: %w", pid, err)
	}
	for line := range strings.Lines(string(data)) {
		if cgroup, ok := strings.CutPrefix(strings.TrimSpace(line), unifiedCgroupPrefix); ok {
			return cgroup, nil
		}
	}
	return "", fmt.Errorf("process %d has no cgroup v2 entry", pid)
}

func awaitJob(ctx context.Context, result <-chan string) error {
	select {
	case outcome := <-result:
		if outcome != scopeJobDone {
			return fmt.Errorf("systemd job %s", outcome)
		}
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func property(name string, value any) systemd.Property {
	return systemd.Property{Name: name, Value: godbus.MakeVariant(value)}
}

type deviceLimit struct {
	Path  string
	Limit uint64
}

func LimitSliceMemory(ctx context.Context, memoryMaxBytes uint64) error {
	connection, err := systemd.NewSystemConnectionContext(ctx)
	if err != nil {
		return fmt.Errorf("connect to systemd: %w", err)
	}
	defer connection.Close()
	properties := []systemd.Property{
		property("MemoryMax", memoryMaxBytes),
		property("MemorySwapMax", uint64(0)),
	}
	setErr := connection.SetUnitPropertiesContext(ctx, Slice, true, properties...)
	if setErr == nil {
		return nil
	}
	result := make(chan string, 1)
	if _, err := connection.StartTransientUnitContext(ctx, Slice, scopeJobMode, properties, result); err != nil {
		return fmt.Errorf("limit the memory of %s: %w", Slice, errors.Join(setErr, err))
	}
	if err := awaitJob(ctx, result); err != nil {
		return fmt.Errorf("limit the memory of %s: %w", Slice, errors.Join(setErr, err))
	}
	return nil
}

func SetDiskWriteLimits(ctx context.Context, id string, limits Limits) error {
	connection, err := systemd.NewSystemConnectionContext(ctx)
	if err != nil {
		return fmt.Errorf("connect to systemd: %w", err)
	}
	defer connection.Close()
	bandwidth := []deviceLimit{}
	operations := []deviceLimit{}
	if limits.DiskPath != "" {
		bandwidth = append(bandwidth, deviceLimit{Path: limits.DiskPath, Limit: limits.DiskBytesPerSecond})
		operations = append(operations, deviceLimit{Path: limits.DiskPath, Limit: limits.DiskOperationsPerSecond})
	}
	if err := connection.SetUnitPropertiesContext(ctx, ScopeName(id), true,
		property("IOWriteBandwidthMax", bandwidth),
		property("IOWriteIOPSMax", operations),
	); err != nil {
		return fmt.Errorf("set disk write limits of microVM %s: %w", id, err)
	}
	return nil
}

func diskLimits(limits Limits) []systemd.Property {
	if limits.DiskPath == "" {
		return nil
	}
	bandwidth := []deviceLimit{{Path: limits.DiskPath, Limit: limits.DiskBytesPerSecond}}
	operations := []deviceLimit{{Path: limits.DiskPath, Limit: limits.DiskOperationsPerSecond}}
	return []systemd.Property{
		property("IOReadBandwidthMax", bandwidth),
		property("IOWriteBandwidthMax", bandwidth),
		property("IOReadIOPSMax", operations),
		property("IOWriteIOPSMax", operations),
	}
}
