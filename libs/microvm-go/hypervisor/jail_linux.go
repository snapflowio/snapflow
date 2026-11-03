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

package hypervisor

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"slices"

	"github.com/snapflowio/microvm-go/internal/jailidentity"
	"github.com/snapflowio/microvm-go/jail"
)

const (
	vmmOpenFileLimit   = 4096
	vmmMemoryOverhead  = 256 << 20
	vmmTasksBase       = 64
	vmmTasksPerVCPU    = 4
	lockedMemoryMargin = 64 << 20
	// Disk caps scale with VM size, as cloud block storage scales with
	// instance size, so one tenant cannot starve the shared disk.
	vmmDiskBytesPerVCPU      = 128 << 20
	vmmDiskOperationsPerVCPU = 4000
	vfioControlDevice        = "/dev/vfio/vfio"
	vfioGroupDirectory       = "/dev/vfio"
	iommuGroupLink           = "iommu_group"
	createdLogFileMode       = 0o600
)

// baseDevices are the device nodes every VMM needs: KVM, the TUN control
// device to attach its TAP, and a randomness source.
func baseDevices() []string {
	return []string{"/dev/kvm", "/dev/net/tun", "/dev/urandom"}
}

// startJailed runs the VMM inside its jail and its systemd scope. A scope
// failure kills the VMM: an unconfined VMM must never keep running.
func startJailed(ctx context.Context, cfg VM, spec LaunchSpec, output *os.File) (*exec.Cmd, error) {
	jailSpec, err := jailSpec(cfg, spec)
	if err != nil {
		return nil, err
	}
	command, err := jail.Command(ctx, jailSpec, output)
	if err != nil {
		return nil, err
	}
	if err := jail.Start(command, jailSpec); err != nil {
		return nil, err
	}
	limits := jail.Limits{
		CPUs:                    cfg.VCPUs,
		MemoryBytes:             uint64(cfg.MemoryBytes) + vmmMemoryOverhead,
		Tasks:                   uint64(vmmTasksBase + cfg.VCPUs*vmmTasksPerVCPU),
		DiskPath:                cfg.Jail.Root,
		DiskBytesPerSecond:      uint64(cfg.VCPUs) * vmmDiskBytesPerVCPU,
		DiskOperationsPerSecond: uint64(cfg.VCPUs) * vmmDiskOperationsPerVCPU,
	}
	if err := jail.Place(ctx, cfg.ID, command.Process.Pid, limits); err != nil {
		return nil, errors.Join(err, command.Process.Kill(), command.Wait())
	}
	return command, nil
}

func jailSpec(cfg VM, spec LaunchSpec) (jail.Spec, error) {
	uid, gid, err := jailidentity.ForInstance(cfg.ID)
	if err != nil {
		return jail.Spec{}, fmt.Errorf("resolve VMM identity: %w", err)
	}
	if err := ensureFiles(cfg.SerialLogPath); err != nil {
		return jail.Spec{}, err
	}
	readOnly := slices.Concat(cfg.Jail.ReadOnly, spec.ReadOnly, nonEmpty(cfg.KernelPath, cfg.InitrdPath))
	writable := slices.Concat(cfg.Jail.Writable, nonEmpty(cfg.SerialLogPath))
	for _, disk := range cfg.Disks {
		if disk.Readonly {
			readOnly = append(readOnly, disk.Path)
		} else {
			writable = append(writable, disk.Path)
		}
	}
	devices, err := vfioDevices(cfg.PCIDevices)
	if err != nil {
		return jail.Spec{}, err
	}
	var lockedMemory uint64
	if len(cfg.PCIDevices) > 0 {
		lockedMemory = uint64(cfg.MemoryBytes) + lockedMemoryMargin
	}
	return jail.Spec{
		ID: cfg.ID, Root: cfg.Jail.Root, UID: uid, GID: gid,
		Executable: cfg.HypervisorBin, Arguments: spec.Arguments,
		ReadOnly: cleanPaths(readOnly), Writable: cleanPaths(writable),
		Devices: append(baseDevices(), devices...), Sysfs: spec.Sysfs,
		NetworkNamespace:  cfg.NetworkNamespace,
		OpenFiles:         vmmOpenFileLimit,
		LockedMemoryBytes: lockedMemory,
	}, nil
}

// vfioDevices are the VFIO container and the group device of every PCI device
// passed through; the whole IOMMU group was bound to vfio-pci beforehand.
func vfioDevices(pciDevices []string) ([]string, error) {
	if len(pciDevices) == 0 {
		return nil, nil
	}
	devices := []string{vfioControlDevice}
	for _, device := range pciDevices {
		group, err := os.Readlink(filepath.Join(device, iommuGroupLink))
		if err != nil {
			return nil, fmt.Errorf("resolve IOMMU group of %s: %w", device, err)
		}
		path := filepath.Join(vfioGroupDirectory, filepath.Base(group))
		if !slices.Contains(devices, path) {
			devices = append(devices, path)
		}
	}
	return devices, nil
}

func ensureFiles(paths ...string) error {
	for _, path := range nonEmpty(paths...) {
		file, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, createdLogFileMode)
		if err != nil {
			return fmt.Errorf("create %s: %w", path, err)
		}
		if err := file.Close(); err != nil {
			return fmt.Errorf("close %s: %w", path, err)
		}
	}
	return nil
}

func nonEmpty(values ...string) []string {
	return slices.DeleteFunc(slices.Clone(values), func(value string) bool { return value == "" })
}

func cleanPaths(paths []string) []string {
	cleaned := make([]string, 0, len(paths))
	for _, path := range paths {
		cleaned = append(cleaned, filepath.Clean(path))
	}
	slices.Sort(cleaned)
	return slices.Compact(cleaned)
}
