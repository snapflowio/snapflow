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
	bitsPerByte         = 8
)

// pinning serializes choosing cores with creating the scope that holds them,
// so two launches never take the same free core.
var pinning sync.Mutex //nolint:gochecknoglobals // the cores belong to the host, so every Place in the process must share one lock

// wholeCores picks enough free physical cores to run vcpus. A core is free
// when no live VM scope holds any of its SMT siblings, so tenants never share
// a core (the Firecracker side-channel guidance). The live scopes are the
// record, which keeps the choice correct across daemon restarts.
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
		allowed, err := connection.GetUnitTypePropertyContext(ctx, unit.Name, scopeUnitType, allowedCPUsProperty)
		if err != nil {
			return nil, fmt.Errorf("read CPUs of %s: %w", unit.Name, err)
		}
		mask, ok := allowed.Value.Value().([]byte)
		if !ok {
			return nil, fmt.Errorf("read CPUs of %s: unexpected %s value %v", unit.Name, allowedCPUsProperty, allowed.Value)
		}
		for _, cpu := range cpusInMask(mask) {
			held[cpu] = true
		}
	}
	return held, nil
}

// cpuMask encodes CPUs as systemd's AllowedCPUs bitmask: bit n of the byte
// array, least significant bit first, is CPU n.
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
