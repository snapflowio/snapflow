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
	"os/exec"
	"path/filepath"
	"strings"

	microvmhost "github.com/snapflowio/microvm-go/host"
	"golang.org/x/sys/unix"
)

const (
	CheckLandlock       = "landlock"
	CheckKSM            = "ksm"
	CheckCPUMitigations = "cpu-mitigations"
)

// Cloud Hypervisor enforces Landlock ABI v3 as a hard requirement; ABI v3
// first shipped in Linux 6.2.
const (
	minimumLandlockABI = 3

	ksmRunPath = "kernel/mm/ksm/run"
	// KSM is idle when stopped (0) or stopped after unmerging every page (2).
	ksmStopped  = "0"
	ksmUnmerged = "2"

	vulnerabilitiesPath = "devices/system/cpu/vulnerabilities"
	vulnerablePrefix    = "Vulnerable"

	landlockDetail      = "Linux 6.2+ with Landlock enabled confines every Cloud Hypervisor process"
	ksmDetail           = "KSM is off, so microVMs never share merged memory pages"
	mitigationsDetail   = "the kernel reports every CPU vulnerability as mitigated or not affected"
	landlockRemediation = "boot Linux 6.2 or newer with Landlock enabled (add landlock to the `lsm=` kernel parameter " +
		"if it is built but inactive); Cloud Hypervisor refuses to start without it"
	ksmRemediation = "stop KSM with `echo 2 | sudo tee /sys/kernel/mm/ksm/run` and disable ksmtuned or the ksm service; " +
		"merged pages let one guest observe another's memory through timing"
	mitigationsRemediation = "install the latest CPU microcode and kernel, and do not boot with `mitigations=off`"
)

const (
	liveSysfs  = "/sys"
	liveProcfs = "/proc"
	liveRootfs = "/"
)

// hostInspector reads host state below injectable roots so the decisions
// can be tested against fixture trees.
type hostInspector struct {
	sysfs        string
	procfs       string
	rootfs       string
	lookPath     func(string) (string, error)
	landlockABI  func() (int, error)
	libraryCache func(context.Context) ([]byte, error)
}

func liveHost() hostInspector {
	return hostInspector{sysfs: liveSysfs, procfs: liveProcfs, rootfs: liveRootfs, lookPath: exec.LookPath, libraryCache: ldconfigCache, landlockABI: landlockABIVersion}
}

func (report *Diagnosis) checkHostIsolation(ctx context.Context, inspector hostInspector) {
	report.add(CheckLandlock, true, inspector.landlock(), landlockDetail, landlockRemediation)
	report.add(CheckKSM, true, inspector.ksmStopped(), ksmDetail, ksmRemediation)
	report.add(CheckCPUMitigations, false, inspector.cpuMitigations(), mitigationsDetail, mitigationsRemediation)
	gpus, err := microvmhost.DiscoverPassthroughGPUs()
	if err != nil {
		report.add(CheckGPUDiscovery, false, err, "", gpuDiscoveryRemediation)
		return
	}
	release, releaseErr := kernelRelease()
	report.checkGPUIsolation(ctx, inspector, release, releaseErr, nvidiaGPUs(gpus))
}

func kernelRelease() (string, error) {
	var name unix.Utsname
	if err := unix.Uname(&name); err != nil {
		return "", fmt.Errorf("read kernel release: %w", err)
	}
	return unix.ByteSliceToString(name.Release[:]), nil
}

func (inspector hostInspector) landlock() error {
	abi, err := inspector.landlockABI()
	if err != nil {
		return err
	}
	if abi < minimumLandlockABI {
		return fmt.Errorf("the kernel offers Landlock ABI v%d; Cloud Hypervisor needs v%d (Linux 6.2+)", abi, minimumLandlockABI)
	}
	return nil
}

// ksmStopped passes when KSM is idle or not built into the kernel.
func (inspector hostInspector) ksmStopped() error {
	value, err := os.ReadFile(filepath.Join(inspector.sysfs, ksmRunPath))
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("read KSM state: %w", err)
	}
	state := strings.TrimSpace(string(value))
	if state != ksmStopped && state != ksmUnmerged {
		return fmt.Errorf("KSM is merging pages (run=%s)", state)
	}
	return nil
}

func (inspector hostInspector) cpuMitigations() error {
	directory := filepath.Join(inspector.sysfs, vulnerabilitiesPath)
	entries, err := os.ReadDir(directory)
	if err != nil {
		return fmt.Errorf("read CPU vulnerability status: %w", err)
	}
	var vulnerable []string
	for _, entry := range entries {
		status, err := os.ReadFile(filepath.Join(directory, entry.Name()))
		if err != nil {
			return fmt.Errorf("read CPU vulnerability %s: %w", entry.Name(), err)
		}
		if text := strings.TrimSpace(string(status)); strings.HasPrefix(text, vulnerablePrefix) {
			vulnerable = append(vulnerable, entry.Name()+": "+text)
		}
	}
	if len(vulnerable) > 0 {
		return fmt.Errorf("unmitigated CPU vulnerabilities: %s", strings.Join(vulnerable, "; "))
	}
	return nil
}
