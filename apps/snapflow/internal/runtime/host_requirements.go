// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package runtime

import (
	"fmt"
	"strings"

	"github.com/snapflowio/microvm-go/host"
)

const preflightWarningSeparator = "; "

// RequireHost refuses to run sandboxes on a host that cannot isolate them.
func RequireHost(report host.PreflightReport) error {
	requirements := []struct {
		met         bool
		description string
	}{
		{met: report.KVMAvailable, description: "KVM is unavailable"},
		{met: report.NetworkPolicyAvailable, description: "host nftables network policy support is unavailable"},
		{met: report.IPv4ForwardingEnabled, description: "IPv4 forwarding is disabled"},
		{met: report.HostToolsAvailable, description: "required filesystem tools (e2fsprogs, the bundled mkfs.erofs) are unavailable"},
		{met: report.JailCgroupAvailable, description: "cgroup v2 with the cpu, memory and pids controllers is unavailable for VM limits"},
		{met: report.SystemdAvailable, description: "systemd is unreachable, so VMs cannot run in resource-limited scopes"},
	}
	var unmet []string
	for _, requirement := range requirements {
		if !requirement.met {
			unmet = append(unmet, requirement.description)
		}
	}
	if len(unmet) == 0 {
		return nil
	}
	return fmt.Errorf(
		"microVM host preflight failed: %s; details: %s",
		strings.Join(unmet, preflightWarningSeparator),
		strings.Join(report.Warnings, preflightWarningSeparator),
	)
}
