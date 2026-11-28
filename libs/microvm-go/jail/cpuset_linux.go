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

package jail

import (
	"context"
	"fmt"
	"slices"
	"sync"

	systemd "github.com/coreos/go-systemd/v22/dbus"

	"github.com/snapflowio/microvm-go/cputopology"
)

const (
	scopePattern        = scopePrefix + "*" + scopeSuffix
	scopeUnitType       = "Scope"
	allowedCPUsProperty = "AllowedCPUs"
	tasksProperty       = "TasksCurrent"
	bitsPerByte         = 8
	activeUnitState     = "active"
)

var pinning sync.Mutex //nolint:gochecknoglobals // the cores belong to the host, so every Place in the process must share one lock

func wholeCores(ctx context.Context, connection *systemd.Conn, vcpus int) ([]int, error) {
	cores, err := cputopology.Cores()
	if err != nil {
		return nil, err
	}
	held, err := heldCPUs(ctx, connection)
	if err != nil {
		return nil, err
	}
	threads := cputopology.ThreadsPerCore(cores)
	wanted := (vcpus + threads - 1) / threads
	needed := wanted
	var chosen []int
	for _, core := range cores {
		if needed == 0 {
			break
		}
		if slices.ContainsFunc(core, func(cpu int) bool { return held[cpu] }) {
			continue
		}
		chosen = append(chosen, core...)
		needed--
	}
	if needed > 0 {
		return nil, fmt.Errorf("no %d free physical cores for %d vCPUs", wanted, vcpus)
	}
	return chosen, nil
}

func heldCPUs(ctx context.Context, connection *systemd.Conn) (map[int]bool, error) {
	units, err := connection.ListUnitsByPatternsContext(ctx, nil, []string{scopePattern})
	if err != nil {
		return nil, fmt.Errorf("list VM scopes: %w", err)
	}
	held := map[int]bool{}
	for _, unit := range units {
		if unit.ActiveState != activeUnitState {
			continue
		}
		cpus, err := liveScopeCPUs(ctx, connection, unit.Name)
		if err != nil {
			return nil, err
		}
		for _, cpu := range cpus {
			held[cpu] = true
		}
	}
	return held, nil
}

func liveScopeCPUs(ctx context.Context, connection *systemd.Conn, unit string) ([]int, error) {
	empty, err := emptyScope(ctx, connection, unit)
	if err != nil {
		return nil, err
	}
	if empty {
		if err := stopScope(ctx, connection, unit); err != nil {
			return nil, fmt.Errorf("reclaim empty VM scope: %w", err)
		}
		return nil, nil
	}
	allowed, err := connection.GetUnitTypePropertyContext(ctx, unit, scopeUnitType, allowedCPUsProperty)
	if err != nil {
		return nil, fmt.Errorf("read CPUs of %s: %w", unit, err)
	}
	mask, ok := allowed.Value.Value().([]byte)
	if !ok {
		return nil, fmt.Errorf("read CPUs of %s: unexpected %s value %v", unit, allowedCPUsProperty, allowed.Value)
	}
	return cpusInMask(mask), nil
}

func emptyScope(ctx context.Context, connection *systemd.Conn, unit string) (bool, error) {
	tasks, err := connection.GetUnitTypePropertyContext(ctx, unit, scopeUnitType, tasksProperty)
	if err != nil {
		return false, fmt.Errorf("read tasks of %s: %w", unit, err)
	}
	count, ok := tasks.Value.Value().(uint64)
	if !ok {
		return false, fmt.Errorf("read tasks of %s: unexpected %s value %v", unit, tasksProperty, tasks.Value)
	}
	return count == 0, nil
}

func cpuMask(cpus []int) []byte {
	mask := make([]byte, slices.Max(cpus)/bitsPerByte+1)
	for _, cpu := range cpus {
		mask[cpu/bitsPerByte] |= 1 << (cpu % bitsPerByte)
	}
	return mask
}

func cpusInMask(mask []byte) []int {
	var cpus []int
	for index, value := range mask {
		for bit := range bitsPerByte {
			if value&(1<<bit) != 0 {
				cpus = append(cpus, index*bitsPerByte+bit)
			}
		}
	}
	return cpus
}
