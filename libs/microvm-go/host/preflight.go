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

package host

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/internal/filemode"
	"github.com/snapflowio/microvm-go/kvm"
	"github.com/snapflowio/microvm-go/layout"
)

const (
	cgroupV2Root        = "/sys/fs/cgroup"
	socketLayoutProbeID = "00000000-0000-4000-8000-000000000000"
	dataDirMode         = 0o755
)

type PreflightConfig struct {
	DataDir             string
	CheckImageFormatter func() error
}

type PreflightReport struct {
	KVMAvailable                 bool
	FirecrackerSnapshotAvailable bool
	FirecrackerTemplateAvailable bool
	CgroupV2Available            bool
	JailCgroupAvailable          bool
	SystemdAvailable             bool
	NetworkPolicyAvailable       bool
	IPv4ForwardingEnabled        bool
	HostToolsAvailable           bool
	DataDir                      string
	Warnings                     []string
}

func Preflight(config PreflightConfig) (PreflightReport, error) {
	report := PreflightReport{DataDir: strings.TrimSpace(config.DataDir)}
	if config.CheckImageFormatter == nil {
		return report, errors.New("image formatter check is required")
	}
	if report.DataDir == "" {
		return report, errors.New("microvm data dir is required")
	}
	if err := validateSocketLayout(layout.NewPaths(report.DataDir)); err != nil {
		return report, err
	}
	if err := os.MkdirAll(report.DataDir, dataDirMode); err != nil {
		return report, fmt.Errorf("create microvm data dir %s: %w", report.DataDir, err)
	}
	switch runtime.GOOS {
	case "linux":
		report.checkLinux()
	default:
		report.Warnings = append(report.Warnings, "Firecracker and Cloud Hypervisor require Linux/KVM")
	}
	report.HostToolsAvailable = report.passes(errors.Join(CheckExt4Tools(), config.CheckImageFormatter()))
	return report, nil
}

func validateSocketLayout(paths layout.Paths) error {
	for _, hv := range hypervisor.SupportedHypervisors() {
		if err := hypervisor.ValidateUnixSocketPath(paths.InstanceSocket(socketLayoutProbeID, hypervisor.APISocketName(hv))); err != nil {
			return fmt.Errorf("validate %s socket layout: %w", hv, err)
		}
	}
	return nil
}

func (report *PreflightReport) checkLinux() {
	report.NetworkPolicyAvailable = report.passes(CheckNftablesAccess())
	report.KVMAvailable = report.passes(kvm.CheckAccess())
	report.IPv4ForwardingEnabled = report.passes(CheckIPv4Forwarding())
	report.CgroupV2Available = report.passes(checkCgroupV2())
	report.JailCgroupAvailable = report.CgroupV2Available && report.passes(ValidateJailCgroup())
	report.SystemdAvailable = report.passes(CheckSystemd())
	report.warn(checkDataDirStorage(report.DataDir))
	report.FirecrackerSnapshotAvailable = report.passes(FirecrackerSnapshotCompatibility(report.DataDir))
	report.FirecrackerTemplateAvailable = report.FirecrackerSnapshotAvailable &&
		report.passes(FirecrackerTemplateCloneCompatibility(report.DataDir))
}

func (report *PreflightReport) passes(err error) bool {
	report.warn(err)
	return err == nil
}

func (report *PreflightReport) warn(err error) {
	if err != nil {
		report.Warnings = append(report.Warnings, err.Error())
	}
}

func FirecrackerTemplateCloneCompatibility(dataDir string) error {
	if runtime.GOOS != "linux" {
		return errors.New("firecracker template cloning requires Linux")
	}
	if err := checkHardlinkSupport(dataDir); err != nil {
		return fmt.Errorf("firecracker template cache requires hard-link support: %w", err)
	}
	if err := checkReflinkSupport(dataDir); err != nil {
		return fmt.Errorf("firecracker prepared templates require copy-on-write reflink support: %w", err)
	}
	return nil
}

func FirecrackerSnapshotCompatibility(dataDir string) error {
	if runtime.GOOS != "linux" {
		return errors.New("firecracker snapshot restore requires Linux")
	}
	if err := kvm.CheckAccess(); err != nil {
		return fmt.Errorf("firecracker snapshot restore requires KVM: %w", err)
	}
	if err := firecrackerSnapshotCPUCompatibility(); err != nil {
		return err
	}
	if err := checkHardlinkSupport(dataDir); err != nil {
		return fmt.Errorf("firecracker template cache requires hard-link support: %w", err)
	}
	return nil
}

func firecrackerSnapshotCPUCompatibility() error {
	if runtime.GOARCH != "amd64" {
		return nil
	}
	data, err := os.ReadFile("/proc/cpuinfo")
	if err != nil {
		return fmt.Errorf("read host CPU information: %w", err)
	}
	for _, line := range strings.Split(string(data), "\n") {
		name, value, found := strings.Cut(line, ":")
		if !found || strings.TrimSpace(name) != "flags" {
			continue
		}
		for _, flag := range strings.Fields(value) {
			if flag == "rtm" || flag == "hle" {
				return errors.New("firecracker snapshot templates require a custom CPU template on hosts that expose Intel TSX")
			}
		}
	}
	return nil
}

func checkHardlinkSupport(dataDir string) error {
	dataDir = strings.TrimSpace(dataDir)
	if dataDir == "" {
		return errors.New("microvm data dir is required")
	}
	probeDir := filepath.Join(dataDir, "system")
	if err := os.MkdirAll(probeDir, filemode.SharedDirectory); err != nil {
		return fmt.Errorf("create template probe directory: %w", err)
	}
	source, err := os.CreateTemp(probeDir, ".template-link-probe-*")
	if err != nil {
		return fmt.Errorf("create template clone probe: %w", err)
	}
	sourcePath := source.Name()
	targetPath := sourcePath + ".link"
	if err := source.Close(); err != nil {
		return errors.Join(fmt.Errorf("close template clone probe: %w", err), os.Remove(sourcePath))
	}
	linkErr := os.Link(sourcePath, targetPath)
	cleanupErr := errors.Join(os.Remove(targetPath), os.Remove(sourcePath))
	if linkErr != nil {
		return errors.Join(linkErr, cleanupErr)
	}
	return cleanupErr
}

func checkCgroupV2() error {
	if _, err := os.Stat(filepath.Join(cgroupV2Root, "cgroup.controllers")); err != nil {
		return fmt.Errorf("cgroup v2 is unavailable: %w", err)
	}
	return nil
}

// ValidateJailCgroup checks that the cgroup v2 controllers VM scopes rely on
// for CPU, memory and process limits exist on this host.
func ValidateJailCgroup() error {
	return validateJailCgroupAt(cgroupV2Root)
}

func jailControllers() []string { return []string{"cpu", "memory", "pids"} }

func validateJailCgroupAt(root string) error {
	controllers, err := os.ReadFile(filepath.Join(root, "cgroup.controllers"))
	if err != nil {
		return fmt.Errorf("read cgroup controllers: %w", err)
	}
	for _, controller := range jailControllers() {
		if !containsField(string(controllers), controller) {
			return fmt.Errorf("VM resource limits require the cgroup v2 %s controller", controller)
		}
	}
	return nil
}

func containsField(value, expected string) bool {
	for _, field := range strings.Fields(value) {
		if field == expected {
			return true
		}
	}
	return false
}
