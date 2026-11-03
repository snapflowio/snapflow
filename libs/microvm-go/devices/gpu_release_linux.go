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
	"io/fs"
	"os"
	"path/filepath"
	"regexp"

	"github.com/snapflowio/microvm-go/host"
	"github.com/snapflowio/microvm-go/internal/filemode"
)

const (
	nvidiaDriver         = "nvidia"
	functionResetFile    = "reset"
	subordinateResetFile = "reset_subordinate"
	resetTrigger         = "1"
)

var pciAddressPattern = regexp.MustCompile(`^[0-9a-f]{4}:[0-9a-f]{2}:[0-9a-f]{2}\.[0-7]$`)

// Release hands each assigned IOMMU group back to the host clean: every
// function is reset and rebound to its host driver, then the GPU must pass a
// driver health check and a VRAM scrub. A GPU that fails any step is
// quarantined until the host reboots rather than failing the release, so the
// tenant's lease still ends and the GPU is never offered again.
func (m PassthroughGPUManager) Release(ctx context.Context, assignments []GPUDevice) error {
	var releaseErrors []error
	for _, assignment := range uniqueGroups(assignments) {
		cleanseErr := cleanseGPU(ctx, assignment)
		if cleanseErr == nil {
			continue
		}
		if err := m.quarantine.Add(assignment.PCIAddress, cleanseErr); err != nil {
			releaseErrors = append(releaseErrors, errors.Join(cleanseErr, err))
		}
	}
	return errors.Join(releaseErrors...)
}

func cleanseGPU(ctx context.Context, assignment GPUDevice) error {
	if err := resetIOMMUGroup(assignment); err != nil {
		return errors.Join(err, restoreGroup(ctx, assignment))
	}
	if err := restoreGroup(ctx, assignment); err != nil {
		return err
	}
	if driver := pciDriver(assignment.PCIAddress); driver != nvidiaDriver {
		return fmt.Errorf("gpu %s came back on driver %q; health check and scrub need %q", assignment.PCIAddress, driver, nvidiaDriver)
	}
	if err := host.CheckGPUHealth(ctx, assignment.PCIAddress); err != nil {
		return err
	}
	return scrubGPU(ctx, assignment.PCIAddress)
}

// resetIOMMUGroup resets every function in the group. Boards whose functions
// cannot reset on their own (a GPU beside its audio function, for example)
// fall back to a secondary bus reset, but only when the bridge serves nothing
// outside the group.
func resetIOMMUGroup(device GPUDevice) error {
	functionErr := resetFunctions(device.Bindings)
	if functionErr == nil {
		return nil
	}
	if err := resetBelowBridge(device); err != nil {
		return fmt.Errorf("reset IOMMU group %d: %w", device.IOMMUGroup, errors.Join(functionErr, err))
	}
	return nil
}

func resetFunctions(bindings []PCIDeviceBinding) error {
	for _, binding := range bindings {
		path := filepath.Join(sysfsPCIDevicesPath, binding.PCIAddress, functionResetFile)
		if err := os.WriteFile(path, []byte(resetTrigger), filemode.WriteOnlyFile); err != nil {
			return fmt.Errorf("function reset of %s: %w", binding.PCIAddress, err)
		}
	}
	return nil
}

func resetBelowBridge(device GPUDevice) error {
	resolved, err := filepath.EvalSymlinks(filepath.Join(sysfsPCIDevicesPath, device.PCIAddress))
	if err != nil {
		return fmt.Errorf("resolve %s: %w", device.PCIAddress, err)
	}
	bridge := filepath.Dir(resolved)
	inGroup := make(map[string]struct{}, len(device.Bindings))
	for _, binding := range device.Bindings {
		inGroup[normalizePCIAddress(binding.PCIAddress)] = struct{}{}
	}
	err = filepath.WalkDir(bridge, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if path == bridge || !entry.IsDir() || !pciAddressPattern.MatchString(entry.Name()) {
			return nil
		}
		if _, member := inGroup[entry.Name()]; !member {
			return fmt.Errorf("bridge %s also serves %s outside IOMMU group %d", filepath.Base(bridge), entry.Name(), device.IOMMUGroup)
		}
		return nil
	})
	if err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(bridge, subordinateResetFile), []byte(resetTrigger), filemode.WriteOnlyFile); err != nil {
		return fmt.Errorf("secondary bus reset below %s: %w", filepath.Base(bridge), err)
	}
	return nil
}
