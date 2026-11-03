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

	microvmhost "github.com/snapflowio/microvm-go/host"
	"github.com/snapflowio/snapflow/internal/config"
	"golang.org/x/sys/unix"
)

const (
	CheckKVM            = "kvm"
	CheckNetworkPolicy  = "nftables"
	CheckIPv4Forwarding = "ipv4-forwarding"
	CheckHostTools      = "host-tools"
	CheckVMLimits       = "vm-limits"
	CheckSystemd        = "systemd"
	CheckStorage        = "storage"
	CheckReflink        = "reflink"
)

const (
	kvmDevicePath       = "/dev/kvm"
	minimumStorageBytes = 10 * bytesPerGiB
	bytesPerGiB         = 1024 * 1024 * 1024

	kvmRemediation = "enable hardware virtualization (Intel VT-x or AMD-V) in the firmware and load KVM " +
		"with `sudo modprobe kvm_intel` or `sudo modprobe kvm_amd`; cloud VMs need an instance type with nested virtualization"
	networkPolicyRemediation = "load nftables support with `sudo modprobe nf_tables` and run Snapflow as root"
	ipv4Remediation          = "run `sudo sysctl --system` to apply /etc/sysctl.d/60-snapflow.conf, " +
		"or set net.ipv4.ip_forward=1"
	hostToolsRemediation = "install the ext4 tools: `sudo apt install e2fsprogs` (Debian/Ubuntu) " +
		"or `sudo dnf install e2fsprogs` (Fedora/RHEL)"
	cgroupRemediation = "boot with the unified cgroup v2 hierarchy (systemd.unified_cgroup_hierarchy=1) so the cpu, " +
		"memory and pids controllers are available; development containers must join the host cgroup namespace"
	systemdRemediation = "run Snapflow on a systemd host with D-Bus; every microVM runs in a transient systemd scope"
	storageRemediation = "free at least 10 GiB on the filesystem that holds the runtime data directory"
	reflinkRemediation = "for faster sandbox starts, place the runtime data directory on XFS (reflink=1) or Btrfs; " +
		"other filesystems work with full copies"

	kvmDetail           = "/dev/kvm is readable and writable"
	networkPolicyDetail = "nftables is available for sandbox network isolation"
	ipv4Detail          = "net.ipv4.ip_forward=1 lets sandbox traffic reach the uplink"
	hostToolsDetail     = "mkfs.ext4, e2fsck, and resize2fs are installed"
	cgroupDetail        = "cgroup v2 can limit every microVM's CPU, memory and processes"
	systemdDetail       = "systemd places every microVM in its own resource-limited scope"
	reflinkDetail       = "copy-on-write clones are available for prepared sandbox templates"
)

var errDataDirectoryPending = errors.New("checked once the runtime data directory exists")

func CheckMachine(ctx context.Context, cfg DiagnoseConfig) Diagnosis {
	report := newDiagnosis(cfg)
	report.checkMachine(ctx, cfg.Config)
	return report
}

func (report *Diagnosis) checkMachine(ctx context.Context, cfg *config.Config) {
	dataDirectory := cfg.Runtime.DataDirectory
	report.add(CheckKVM, true, unix.Access(kvmDevicePath, unix.R_OK|unix.W_OK), kvmDetail, kvmRemediation)
	report.add(CheckNetworkPolicy, true, microvmhost.CheckNftablesAccess(), networkPolicyDetail, networkPolicyRemediation)
	report.add(CheckIPv4Forwarding, true, microvmhost.CheckIPv4Forwarding(), ipv4Detail, ipv4Remediation)
	report.add(CheckHostTools, true, microvmhost.CheckExt4Tools(), hostToolsDetail, hostToolsRemediation)
	report.add(CheckVMLimits, true, microvmhost.ValidateJailCgroup(), cgroupDetail, cgroupRemediation)
	report.add(CheckSystemd, true, microvmhost.CheckSystemd(), systemdDetail, systemdRemediation)
	storageDetail, storageErr := storage(dataDirectory)
	report.add(CheckStorage, true, storageErr, storageDetail, storageRemediation)
	report.add(CheckReflink, false, reflink(dataDirectory), reflinkDetail, reflinkRemediation)
	report.checkHostIsolation(ctx, liveHost())
}

func reflink(dataDirectory string) error {
	if _, err := os.Stat(dataDirectory); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return errDataDirectoryPending
		}
		return fmt.Errorf("inspect runtime data directory: %w", err)
	}
	return microvmhost.FirecrackerTemplateCloneCompatibility(dataDirectory)
}

func storage(path string) (string, error) {
	candidate, err := existingAncestor(filepath.Clean(path))
	if err != nil {
		return "", err
	}
	var statistics unix.Statfs_t
	if err := unix.Statfs(candidate, &statistics); err != nil {
		return "", fmt.Errorf("inspect filesystem %s: %w", candidate, err)
	}
	available := statistics.Bavail * uint64(statistics.Bsize)
	if available < minimumStorageBytes {
		return "", fmt.Errorf("%s free on %s; at least %s required",
			formatGiB(available), candidate, formatGiB(minimumStorageBytes))
	}
	return fmt.Sprintf("%s free on %s", formatGiB(available), candidate), nil
}

func existingAncestor(candidate string) (string, error) {
	for {
		if _, err := os.Stat(candidate); err == nil {
			return candidate, nil
		} else if !errors.Is(err, os.ErrNotExist) {
			return "", fmt.Errorf("inspect %s: %w", candidate, err)
		}
		parent := filepath.Dir(candidate)
		if parent == candidate {
			return "", errors.New("runtime data path has no existing filesystem ancestor")
		}
		candidate = parent
	}
}

func formatGiB(bytes uint64) string {
	return fmt.Sprintf("%.1f GiB", float64(bytes)/bytesPerGiB)
}
