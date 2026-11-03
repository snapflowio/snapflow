// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package doctor

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"testing"

	microvmhost "github.com/snapflowio/microvm-go/host"
)

const (
	fixtureFileMode      = 0o644
	fixtureDirectoryMode = 0o755
	fixtureRelease       = "6.8.0-45-generic"
	gpuAddress           = "0000:01:00.0"
	gpuAudioAddress      = "0000:01:00.1"
	gpuGroup             = 7
	noIOMMUGroup         = -1
)

var errMissingTool = errors.New("not found")

type fixture struct {
	t    *testing.T
	root string
}

func newFixture(t *testing.T) fixture { return fixture{t: t, root: t.TempDir()} }

func (f fixture) inspector() hostInspector {
	return hostInspector{
		sysfs: filepath.Join(f.root, "sys"), procfs: filepath.Join(f.root, "proc"), rootfs: f.root,
		lookPath:     func(string) (string, error) { return "", errMissingTool },
		libraryCache: func(context.Context) ([]byte, error) { return nil, nil },
	}
}

func (f fixture) write(path, content string) {
	f.t.Helper()
	full := filepath.Join(f.root, path)
	if err := os.MkdirAll(filepath.Dir(full), fixtureDirectoryMode); err != nil {
		f.t.Fatal(err)
	}
	if err := os.WriteFile(full, []byte(content), fixtureFileMode); err != nil {
		f.t.Fatal(err)
	}
}

func (f fixture) mkdir(path string) {
	f.t.Helper()
	if err := os.MkdirAll(filepath.Join(f.root, path), fixtureDirectoryMode); err != nil {
		f.t.Fatal(err)
	}
}

func expectHeld(t *testing.T, name string, err error, held bool) {
	t.Helper()
	if held && err != nil {
		t.Errorf("%s: unexpected failure: %v", name, err)
	}
	if !held && err == nil {
		t.Errorf("%s: expected a failure", name)
	}
}

func TestLandlockNeedsABIv3(t *testing.T) {
	for abi, held := range map[int]bool{1: false, 2: false, 3: true, 6: true} {
		inspector := newFixture(t).inspector()
		inspector.landlockABI = func() (int, error) { return abi, nil }
		expectHeld(t, fmt.Sprintf("Landlock ABI v%d", abi), inspector.landlock(), held)
	}
	inspector := newFixture(t).inspector()
	inspector.landlockABI = func() (int, error) { return 0, errors.New("the kernel has Landlock built in but disabled at boot") }
	expectHeld(t, "Landlock disabled", inspector.landlock(), false)
}

func TestKSMMustBeIdle(t *testing.T) {
	f := newFixture(t)
	expectHeld(t, "KSM not built", f.inspector().ksmStopped(), true)
	for state, held := range map[string]bool{"0\n": true, "2\n": true, "1\n": false} {
		f.write("sys/kernel/mm/ksm/run", state)
		expectHeld(t, "KSM run="+state, f.inspector().ksmStopped(), held)
	}
}

func TestCPUMitigationsFlagVulnerableEntries(t *testing.T) {
	f := newFixture(t)
	f.write("sys/devices/system/cpu/vulnerabilities/meltdown", "Not affected\n")
	f.write("sys/devices/system/cpu/vulnerabilities/spectre_v2", "Mitigation: Enhanced / Automatic IBRS\n")
	expectHeld(t, "all mitigated", f.inspector().cpuMitigations(), true)
	f.write("sys/devices/system/cpu/vulnerabilities/mds", "Vulnerable: Clear CPU buffers attempted, no microcode\n")
	expectHeld(t, "mds vulnerable", f.inspector().cpuMitigations(), false)
}

func TestNvidiaGPUsFiltersByVendor(t *testing.T) {
	gpus := nvidiaGPUs([]microvmhost.GPUDevice{{PCIAddress: gpuAddress, VendorID: "10de"}, {PCIAddress: "0000:02:00.0", VendorID: "1002"}})
	if len(gpus) != 1 || gpus[0].PCIAddress != gpuAddress {
		t.Fatalf("nvidiaGPUs kept %v", gpus)
	}
}

func TestIOMMUGroupMayHoldOnlyTheGPUSlot(t *testing.T) {
	f := newFixture(t)
	gpu := microvmhost.GPUDevice{PCIAddress: gpuAddress, VendorID: nvidiaVendorID, IOMMUGroup: gpuGroup}
	groupDevices := filepath.Join("sys", iommuGroupsPath, strconv.Itoa(gpuGroup), iommuGroupDevices) + "/"
	f.mkdir(groupDevices + gpuAddress)
	f.mkdir(groupDevices + gpuAudioAddress)
	expectHeld(t, "GPU and its audio function", f.inspector().iommuGroups([]microvmhost.GPUDevice{gpu}), true)
	f.mkdir("sys/kernel/iommu_groups/7/devices/0000:00:01.0")
	expectHeld(t, "group shares a bridge", f.inspector().iommuGroups([]microvmhost.GPUDevice{gpu}), false)
	gpu.IOMMUGroup = noIOMMUGroup
	expectHeld(t, "IOMMU off", f.inspector().iommuGroups([]microvmhost.GPUDevice{gpu}), false)
}

func TestNvidiaModesetMustBeOff(t *testing.T) {
	f := newFixture(t)
	expectHeld(t, "nvidia-drm absent", f.inspector().nvidiaModesetOff(), true)
	for value, held := range map[string]bool{"N\n": true, "0\n": true, "Y\n": false, "1\n": false} {
		f.write("sys/module/nvidia_drm/parameters/modeset", value)
		expectHeld(t, "modeset="+value, f.inspector().nvidiaModesetOff(), held)
	}
}

func TestPersistencedMustNotRun(t *testing.T) {
	f := newFixture(t)
	f.write("proc/1/comm", "systemd\n")
	f.write("proc/self/comm", "nvidia-persiste\n")
	expectHeld(t, "no daemon", f.inspector().persistencedStopped(), true)
	f.write("proc/412/comm", "nvidia-persiste\n")
	expectHeld(t, "daemon running", f.inspector().persistencedStopped(), false)
}

func TestVFIOAvailableWhenLoadedOrInstalled(t *testing.T) {
	f := newFixture(t)
	expectHeld(t, "missing", f.inspector().vfioAvailable(fixtureRelease), false)
	f.write("lib/modules/"+fixtureRelease+"/modules.dep", "kernel/drivers/vfio/pci/vfio-pci.ko.zst: kernel/drivers/vfio/vfio.ko.zst\n")
	expectHeld(t, "installed module", f.inspector().vfioAvailable(fixtureRelease), true)
	loaded := newFixture(t)
	loaded.mkdir("sys/bus/pci/drivers/vfio-pci")
	expectHeld(t, "loaded driver", loaded.inspector().vfioAvailable(""), true)
}

func TestGPUScrubToolsNeedNvidiaSMIAndLibcuda(t *testing.T) {
	f := newFixture(t)
	inspector := f.inspector()
	expectHeld(t, "nothing installed", inspector.gpuScrubTools(t.Context()), false)
	inspector.lookPath = func(name string) (string, error) { return "/usr/bin/" + name, nil }
	expectHeld(t, "no libcuda", inspector.gpuScrubTools(t.Context()), false)
	inspector.libraryCache = func(context.Context) ([]byte, error) {
		return []byte("2 libs found in cache `/etc/ld.so.cache'\n\tlibcuda.so.1 (libc6,x86-64) => /usr/lib/x86_64-linux-gnu/libcuda.so.1\n"), nil
	}
	expectHeld(t, "libcuda in loader cache", inspector.gpuScrubTools(t.Context()), true)
	f.write("usr/lib64/libcuda.so.1", "")
	inspector.libraryCache = func(context.Context) ([]byte, error) { return nil, errMissingTool }
	expectHeld(t, "libcuda in a default directory", inspector.gpuScrubTools(t.Context()), true)
}
