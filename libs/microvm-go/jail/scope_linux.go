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
	"fmt"

	systemd "github.com/coreos/go-systemd/v22/dbus"
	godbus "github.com/godbus/dbus/v5"
)

const (
	// Slice holds every VMM scope, outside the daemon's service cgroup, so a
	// daemon restart or crash never takes running VMs with it.
	Slice = "snapflow-vms.slice"

	scopePrefix          = "snapflow-vm-"
	scopeSuffix          = ".scope"
	scopeJobMode         = "fail"
	scopeJobDone         = "done"
	cpuQuotaUnitPerCPU   = uint64(1_000_000)
	collectInactiveUnits = "inactive-or-failed"
)

// ScopeName is the transient unit that holds a VMM's processes.
func ScopeName(id string) string {
	return scopePrefix + id + scopeSuffix
}

// Place moves pid into a transient systemd scope that enforces limits. The
// scope disappears with its last process.
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
		properties = append(properties,
			property("CPUQuotaPerSecUSec", uint64(limits.CPUs)*cpuQuotaUnitPerCPU),
			property(allowedCPUsProperty, cpuMask(cpus)),
		)
	}
	if limits.MemoryBytes > 0 {
		properties = append(properties, property("MemoryMax", limits.MemoryBytes))
	}
	if limits.Tasks > 0 {
		properties = append(properties, property("TasksMax", limits.Tasks))
	}
	properties = append(properties, diskLimits(limits)...)
	result := make(chan string, 1)
	if _, err := connection.StartTransientUnitContext(ctx, ScopeName(id), scopeJobMode, properties, result); err != nil {
		return fmt.Errorf("create scope for microVM %s: %w", id, err)
	}
	select {
	case outcome := <-result:
		if outcome != scopeJobDone {
			return fmt.Errorf("create scope for microVM %s: systemd job %s", id, outcome)
		}
		return nil
	case <-ctx.Done():
		return fmt.Errorf("create scope for microVM %s: %w", id, ctx.Err())
	}
}

func property(name string, value any) systemd.Property {
	return systemd.Property{Name: name, Value: godbus.MakeVariant(value)}
}

// deviceLimit is one entry of systemd's IO*Max properties, D-Bus type a(st).
type deviceLimit struct {
	Path  string
	Limit uint64
}

// diskLimits cap the VM's bandwidth and IOPS on the block device behind
// DiskPath, which systemd resolves from any file on that filesystem.
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
