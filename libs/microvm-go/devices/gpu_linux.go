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
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/snapflowio/microvm-go/host"
	"github.com/snapflowio/microvm-go/internal/filemode"
)

const (
	sysfsPCIDevicesPath         = "/sys/bus/pci/devices"
	vfioControlPath             = "/dev/vfio/vfio"
	vfioPCIDriver               = "vfio-pci"
	vfioGroupDeviceTimeout      = 2 * time.Second
	vfioGroupDevicePollInterval = 25 * time.Millisecond
)

type PassthroughGPUManager struct {
	inventory  map[string]GPUInventoryDevice
	quarantine *GPUQuarantine
}

func NewGPUManager(inventory []GPUInventoryDevice, quarantine *GPUQuarantine) GPUManager {
	indexed := make(map[string]GPUInventoryDevice, len(inventory))
	for _, device := range inventory {
		if address := normalizePCIAddress(device.PCIAddress); address != "" {
			device.PCIAddress = address
			indexed[address] = device
		}
	}
	return PassthroughGPUManager{inventory: indexed, quarantine: quarantine}
}

func (m PassthroughGPUManager) Assign(ctx context.Context, request GPURequest, excluded map[string]struct{}) ([]GPUDevice, error) {
	if request.Count <= 0 {
		return nil, nil
	}
	if err := prepareVFIO(ctx); err != nil {
		return nil, err
	}
	discovered, err := host.DiscoverPassthroughGPUs()
	if err != nil {
		return nil, err
	}
	quarantined, err := m.quarantine.List()
	if err != nil {
		return nil, err
	}
	devices := m.eligibleDevices(discovered, request, excluded, quarantined)
	if int64(len(devices)) < request.Count {
		return nil, ErrInsufficientGPU(request, len(devices))
	}
	planned, err := planDevices(devices[:request.Count])
	if err != nil {
		return nil, err
	}
	if request.Commit != nil {
		if err := request.Commit(append([]GPUDevice(nil), planned...)); err != nil {
			return nil, fmt.Errorf("commit GPU lease intent: %w", err)
		}
	}
	for _, device := range planned {
		if err := acquireIOMMUGroup(ctx, device); err != nil {
			return nil, m.abandonAssignment(ctx, request, planned, err)
		}
	}
	return planned, nil
}

func prepareVFIO(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := exec.CommandContext(ctx, "modprobe", vfioPCIDriver).Run(); err != nil {
		return fmt.Errorf("load vfio-pci: %w", err)
	}
	if _, err := os.Stat(vfioControlPath); err != nil {
		return fmt.Errorf("vfio is not available at %s: %w", vfioControlPath, err)
	}
	return nil
}

func (m PassthroughGPUManager) eligibleDevices(
	discovered []host.GPUDevice,
	request GPURequest,
	excluded map[string]struct{},
	quarantined map[string]QuarantinedGPU,
) []GPUDevice {
	devices := make([]GPUDevice, 0, len(discovered))
	seenGroups := make(map[int]struct{})
	for _, device := range discovered {
		if _, seen := seenGroups[device.IOMMUGroup]; seen || device.IOMMUGroup < 0 {
			continue
		}
		sysfsPath := filepath.Join(sysfsPCIDevicesPath, device.PCIAddress)
		if _, held := quarantined[normalizePCIAddress(device.PCIAddress)]; held || gpuExcluded(excluded, device.PCIAddress, sysfsPath) {
			continue
		}
		inventoryDevice, known := m.inventory[normalizePCIAddress(device.PCIAddress)]
		if !known || !gpuModelMatches(request.Model, inventoryDevice.Model) {
			continue
		}
		devices = append(devices, GPUDevice{
			PCIAddress: device.PCIAddress,
			SysfsPath:  sysfsPath,
			Model:      inventoryDevice.Model,
			IOMMUGroup: device.IOMMUGroup,
		})
		seenGroups[device.IOMMUGroup] = struct{}{}
	}
	return devices
}

func gpuExcluded(excluded map[string]struct{}, identities ...string) bool {
	for _, identity := range identities {
		if _, found := excluded[identity]; found {
			return true
		}
	}
	return false
}

func gpuModelMatches(requested, available string) bool {
	return strings.TrimSpace(requested) == "" || normalizeGPUModel(available) == normalizeGPUModel(requested)
}

func planDevices(selected []GPUDevice) ([]GPUDevice, error) {
	planned := make([]GPUDevice, 0, len(selected))
	for _, device := range selected {
		plan, err := planIOMMUGroup(device)
		if err != nil {
			return nil, err
		}
		planned = append(planned, plan)
	}
	return planned, nil
}

func (PassthroughGPUManager) abandonAssignment(ctx context.Context, request GPURequest, planned []GPUDevice, cause error) error {
	if rollbackErr := restoreGroups(context.WithoutCancel(ctx), planned); rollbackErr != nil {
		return errors.Join(cause, rollbackErr)
	}
	if request.Clear == nil {
		return cause
	}
	return errors.Join(cause, request.Clear())
}

// uniqueGroups returns one assignment per IOMMU group, last assigned first.
func uniqueGroups(assignments []GPUDevice) []GPUDevice {
	groups := make([]GPUDevice, 0, len(assignments))
	seenGroups := map[int]struct{}{}
	for index := len(assignments) - 1; index >= 0; index-- {
		if _, seen := seenGroups[assignments[index].IOMMUGroup]; !seen {
			seenGroups[assignments[index].IOMMUGroup] = struct{}{}
			groups = append(groups, assignments[index])
		}
	}
	return groups
}

// restoreGroups rebinds groups to their host drivers without the release
// checks, for rollbacks where no guest ever held the devices.
func restoreGroups(ctx context.Context, assignments []GPUDevice) error {
	var restoreErrors []error
	for _, assignment := range uniqueGroups(assignments) {
		restoreErrors = append(restoreErrors, restoreGroup(ctx, assignment))
	}
	return errors.Join(restoreErrors...)
}

func restoreGroup(ctx context.Context, assignment GPUDevice) error {
	var restoreErrors []error
	for index := len(assignment.Bindings) - 1; index >= 0; index-- {
		restoreErrors = append(restoreErrors, restorePCIDevice(ctx, assignment.Bindings[index]))
	}
	return errors.Join(restoreErrors...)
}

func planIOMMUGroup(device GPUDevice) (GPUDevice, error) {
	groupDir := filepath.Join("/sys/kernel/iommu_groups", strconv.Itoa(device.IOMMUGroup), "devices")
	entries, err := os.ReadDir(groupDir)
	if err != nil {
		return GPUDevice{}, fmt.Errorf("read IOMMU group %d: %w", device.IOMMUGroup, err)
	}
	addresses := make([]string, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() && entry.Type()&os.ModeSymlink == 0 {
			continue
		}
		addresses = append(addresses, entry.Name())
	}
	slices.Sort(addresses)
	if len(addresses) == 0 {
		return GPUDevice{}, fmt.Errorf("iommu group %d is empty", device.IOMMUGroup)
	}
	bindings := make([]PCIDeviceBinding, 0, len(addresses))
	for _, address := range addresses {
		bindings = append(bindings, PCIDeviceBinding{PCIAddress: address, OriginalDriver: pciDriver(address)})
	}
	device.Bindings = bindings
	return device, nil
}

func acquireIOMMUGroup(ctx context.Context, device GPUDevice) error {
	boundBindings := make([]PCIDeviceBinding, 0, len(device.Bindings))
	rollback := func() error {
		return restoreGroup(context.WithoutCancel(ctx), GPUDevice{IOMMUGroup: device.IOMMUGroup, Bindings: boundBindings})
	}
	for _, binding := range device.Bindings {
		boundBindings = append(boundBindings, binding)
		if err := bindPCIDevice(ctx, binding, vfioPCIDriver); err != nil {
			return errors.Join(
				fmt.Errorf("bind %s in IOMMU group %d to vfio-pci: %w", binding.PCIAddress, device.IOMMUGroup, err),
				rollback(),
			)
		}
	}
	groupDevice := filepath.Join("/dev/vfio", strconv.Itoa(device.IOMMUGroup))
	deadline := time.Now().Add(vfioGroupDeviceTimeout)
	for {
		if _, err := os.Stat(groupDevice); err == nil {
			break
		} else if time.Now().After(deadline) {
			return errors.Join(
				fmt.Errorf("vfio group device %s did not appear", groupDevice),
				rollback(),
			)
		}
		select {
		case <-ctx.Done():
			return errors.Join(ctx.Err(), rollback())
		case <-time.After(vfioGroupDevicePollInterval):
		}
	}
	return nil
}

func restorePCIDevice(ctx context.Context, binding PCIDeviceBinding) error {
	if binding.OriginalDriver == vfioPCIDriver {
		return nil
	}
	if err := bindPCIDevice(ctx, binding, binding.OriginalDriver); err != nil {
		return fmt.Errorf("restore PCI device %s to %q: %w", binding.PCIAddress, binding.OriginalDriver, err)
	}
	return nil
}

func bindPCIDevice(ctx context.Context, binding PCIDeviceBinding, targetDriver string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	address := binding.PCIAddress
	devicePath := filepath.Join(sysfsPCIDevicesPath, address)
	current := pciDriver(address)
	if current == targetDriver {
		if targetDriver == vfioPCIDriver {
			return nil
		}
		return clearPCIDriverOverride(devicePath)
	}
	if current != "" {
		if err := os.WriteFile(filepath.Join(devicePath, "driver", "unbind"), []byte(address), filemode.WriteOnlyFile); err != nil {
			return fmt.Errorf("unbind from %s: %w", current, err)
		}
	}
	if targetDriver == "" {
		return clearPCIDriverOverride(devicePath)
	}
	if err := os.WriteFile(filepath.Join(devicePath, "driver_override"), []byte(targetDriver), filemode.WriteOnlyFile); err != nil {
		return fmt.Errorf("set driver override: %w", err)
	}
	bindPath := filepath.Join("/sys/bus/pci/drivers", targetDriver, "bind")
	if err := os.WriteFile(bindPath, []byte(address), filemode.WriteOnlyFile); err != nil {
		return fmt.Errorf("bind to %s: %w", targetDriver, err)
	}
	if targetDriver != vfioPCIDriver {
		return clearPCIDriverOverride(devicePath)
	}
	return nil
}

func clearPCIDriverOverride(devicePath string) error {
	if err := os.WriteFile(filepath.Join(devicePath, "driver_override"), []byte("\n"), filemode.WriteOnlyFile); err != nil {
		return fmt.Errorf("clear driver override: %w", err)
	}
	return nil
}

func pciDriver(address string) string {
	target, err := os.Readlink(filepath.Join(sysfsPCIDevicesPath, address, "driver"))
	if err != nil {
		return ""
	}
	return filepath.Base(target)
}

func normalizeGPUModel(value string) string {
	fields := strings.Fields(strings.ToLower(strings.TrimSpace(value)))
	if len(fields) > 0 && fields[0] == "nvidia" {
		fields = fields[1:]
	}
	return strings.Join(fields, " ")
}
