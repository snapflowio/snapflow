// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package doctor

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	microvmhost "github.com/snapflowio/microvm-go/host"
	"golang.org/x/sys/unix"
)

const (
	CheckGPUDiscovery  = "gpu-discovery"
	CheckIOMMU         = "iommu"
	CheckNvidiaModeset = "nvidia-drm-modeset"
	CheckPersistenced  = "nvidia-persistenced"
	CheckVFIO          = "vfio-pci"
	CheckGPUScrubTools = "gpu-scrub-tools"
)

const (
	nvidiaVendorID       = "10de"
	pciFunctionSeparator = "."
	iommuGroupsPath      = "kernel/iommu_groups"
	iommuGroupDevices    = "devices"
	modesetPath          = "module/nvidia_drm/parameters/modeset"
	// Kernel bool module parameters read back as Y or N and accept 1 or 0.
	kernelBoolOn           = "Y"
	kernelBoolOff          = "N"
	kernelBoolOne          = "1"
	kernelBoolZero         = "0"
	vfioDriverPath         = "bus/pci/drivers/vfio-pci"
	vfioModulePath         = "module/vfio_pci"
	kernelModulesPath      = "lib/modules"
	vfioModuleFile         = "/vfio-pci.ko"
	modulesBuiltinIndex    = "modules.builtin"
	modulesDependencyIndex = "modules.dep"
	processCommandFile     = "comm"
	// The kernel truncates a process name to 15 characters in comm.
	persistencedCommand = "nvidia-persiste"
	nvidiaSMICommand    = "nvidia-smi"
	cudaLibrary         = "libcuda.so.1"
	ldconfigCommand     = "ldconfig"
	ldconfigPrintCache  = "-p"
	// The dynamic loader searches these directories even without its cache.
	libDirectory      = "lib"
	usrLibDirectory   = "usr/lib"
	lib64Directory    = "lib64"
	usrLib64Directory = "usr/lib64"

	gpuDiscoveryRemediation = "make sure /sys/bus/pci is readable; GPU isolation checks run only once PCI devices can be listed"
	iommuDetail             = "every NVIDIA GPU sits in an IOMMU group that holds only its own functions"
	iommuRemediation        = "enable VT-d or AMD-Vi in the firmware, boot with `intel_iommu=on iommu=pt` or `amd_iommu=on iommu=pt`, " +
		"and move the GPU to a slot whose IOMMU group holds no other device, since the whole group is handed to the guest"
	modesetDetail      = "nvidia-drm kernel modesetting is off, so the host can release the GPU"
	modesetRemediation = "set `options nvidia-drm modeset=0` in /etc/modprobe.d, remove `nvidia-drm.modeset=1` from the kernel " +
		"command line, rebuild the initramfs and reboot"
	persistencedDetail      = "nvidia-persistenced is not holding the GPUs open"
	persistencedRemediation = "run `sudo systemctl disable --now nvidia-persistenced`; it keeps the GPUs open so they cannot move to vfio-pci"
	vfioDetail              = "the vfio-pci driver is available for GPU passthrough"
	vfioRemediation         = "install the kernel's vfio-pci module (the linux-modules-extra package on Ubuntu) and run `sudo modprobe vfio-pci`"
	scrubToolsDetail        = "nvidia-smi and libcuda.so.1 are installed to check and scrub GPUs between tenants"
	scrubToolsRemediation   = "install the NVIDIA driver's user-space utilities and CUDA driver library " +
		"(nvidia-utils and libnvidia-compute on Ubuntu); Snapflow scrubs GPU memory with them before reuse"
)

func (report *Diagnosis) checkGPUIsolation(ctx context.Context, inspector hostInspector, release string, releaseErr error, gpus []microvmhost.GPUDevice) {
	if len(gpus) == 0 {
		return
	}
	report.add(CheckIOMMU, true, inspector.iommuGroups(gpus), iommuDetail, iommuRemediation)
	report.add(CheckNvidiaModeset, true, inspector.nvidiaModesetOff(), modesetDetail, modesetRemediation)
	report.add(CheckPersistenced, true, inspector.persistencedStopped(), persistencedDetail, persistencedRemediation)
	vfioErr := releaseErr
	if vfioErr == nil {
		vfioErr = inspector.vfioAvailable(release)
	}
	report.add(CheckVFIO, true, vfioErr, vfioDetail, vfioRemediation)
	report.add(CheckGPUScrubTools, true, inspector.gpuScrubTools(ctx), scrubToolsDetail, scrubToolsRemediation)
}

func nvidiaGPUs(devices []microvmhost.GPUDevice) []microvmhost.GPUDevice {
	var nvidia []microvmhost.GPUDevice
	for _, device := range devices {
		if strings.EqualFold(device.VendorID, nvidiaVendorID) {
			nvidia = append(nvidia, device)
		}
	}
	return nvidia
}

// iommuGroups requires each GPU's IOMMU group to hold only functions of the
// GPU's own slot: passthrough binds the whole group to vfio-pci, which would
// take any other host device with it, and vfio-pci cannot bind bridges.
func (inspector hostInspector) iommuGroups(gpus []microvmhost.GPUDevice) error {
	var failures []error
	for _, gpu := range gpus {
		if gpu.IOMMUGroup < 0 {
			failures = append(failures, fmt.Errorf("GPU %s has no IOMMU group; the IOMMU is off", gpu.PCIAddress))
			continue
		}
		group := strconv.Itoa(gpu.IOMMUGroup)
		entries, err := os.ReadDir(filepath.Join(inspector.sysfs, iommuGroupsPath, group, iommuGroupDevices))
		if err != nil {
			failures = append(failures, fmt.Errorf("read IOMMU group %s of GPU %s: %w", group, gpu.PCIAddress, err))
			continue
		}
		slot := pciSlot(gpu.PCIAddress)
		var foreign []string
		for _, entry := range entries {
			if pciSlot(entry.Name()) != slot {
				foreign = append(foreign, entry.Name())
			}
		}
		if len(foreign) > 0 {
			failures = append(failures, fmt.Errorf("IOMMU group %s of GPU %s also holds %s", group, gpu.PCIAddress, strings.Join(foreign, ", ")))
		}
	}
	return errors.Join(failures...)
}

// pciSlot drops the function number from a PCI address.
func pciSlot(address string) string {
	if index := strings.LastIndex(address, pciFunctionSeparator); index >= 0 {
		return address[:index]
	}
	return address
}

func (inspector hostInspector) nvidiaModesetOff() error {
	value, err := os.ReadFile(filepath.Join(inspector.sysfs, modesetPath))
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("read nvidia-drm modeset: %w", err)
	}
	switch setting := strings.TrimSpace(string(value)); setting {
	case kernelBoolOff, kernelBoolZero:
		return nil
	case kernelBoolOn, kernelBoolOne:
		return errors.New("nvidia-drm modeset is on")
	default:
		return fmt.Errorf("unrecognized nvidia-drm modeset value %q", setting)
	}
}

func (inspector hostInspector) persistencedStopped() error {
	entries, err := os.ReadDir(inspector.procfs)
	if err != nil {
		return fmt.Errorf("list processes: %w", err)
	}
	for _, entry := range entries {
		if _, err := strconv.Atoi(entry.Name()); err != nil {
			continue
		}
		command, err := os.ReadFile(filepath.Join(inspector.procfs, entry.Name(), processCommandFile))
		if errors.Is(err, os.ErrNotExist) || errors.Is(err, unix.ESRCH) {
			continue
		}
		if err != nil {
			return fmt.Errorf("read process %s name: %w", entry.Name(), err)
		}
		if strings.TrimSpace(string(command)) == persistencedCommand {
			return fmt.Errorf("nvidia-persistenced is running as process %s", entry.Name())
		}
	}
	return nil
}

// vfioAvailable passes when vfio-pci is loaded or built in, or when the
// running kernel ships it as a module modprobe can load.
func (inspector hostInspector) vfioAvailable(release string) error {
	for _, path := range []string{vfioDriverPath, vfioModulePath} {
		if _, err := os.Stat(filepath.Join(inspector.sysfs, path)); err == nil {
			return nil
		}
	}
	if release == "" {
		return errors.New("vfio-pci is not loaded and the kernel release is unknown")
	}
	for _, index := range []string{modulesBuiltinIndex, modulesDependencyIndex} {
		listing, err := os.ReadFile(filepath.Join(inspector.rootfs, kernelModulesPath, release, index))
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil {
			return fmt.Errorf("read kernel module index %s: %w", index, err)
		}
		if bytes.Contains(listing, []byte(vfioModuleFile)) {
			return nil
		}
	}
	return fmt.Errorf("vfio-pci is neither loaded nor installed for kernel %s", release)
}

func (inspector hostInspector) gpuScrubTools(ctx context.Context) error {
	var failures []error
	if _, err := inspector.lookPath(nvidiaSMICommand); err != nil {
		failures = append(failures, fmt.Errorf("find %s: %w", nvidiaSMICommand, err))
	}
	return errors.Join(append(failures, inspector.findLibrary(ctx, cudaLibrary))...)
}

// findLibrary looks where dlopen would: the loader's default directories,
// then its cache.
func (inspector hostInspector) findLibrary(ctx context.Context, library string) error {
	for _, directory := range []string{libDirectory, usrLibDirectory, lib64Directory, usrLib64Directory} {
		if _, err := os.Stat(filepath.Join(inspector.rootfs, directory, library)); err == nil {
			return nil
		}
	}
	cache, err := inspector.libraryCache(ctx)
	if err != nil {
		return fmt.Errorf("find %s: %w", library, err)
	}
	if !cacheListsLibrary(cache, library) {
		return fmt.Errorf("%s is not installed", library)
	}
	return nil
}

func ldconfigCache(ctx context.Context) ([]byte, error) {
	output, err := exec.CommandContext(ctx, ldconfigCommand, ldconfigPrintCache).Output()
	if err != nil {
		return nil, fmt.Errorf("list the dynamic loader cache: %w", err)
	}
	return output, nil
}

// cacheListsLibrary reads `ldconfig -p` output, whose entries look like
// "libcuda.so.1 (libc6,x86-64) => /usr/lib/x86_64-linux-gnu/libcuda.so.1".
func cacheListsLibrary(cache []byte, library string) bool {
	for line := range strings.Lines(string(cache)) {
		if fields := strings.Fields(line); len(fields) > 0 && fields[0] == library {
			return true
		}
	}
	return false
}
