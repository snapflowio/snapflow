// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package runtime

import (
	"strings"
	"testing"

	"github.com/snapflowio/microvm-go/host"
)

func readyHostReport() host.PreflightReport {
	return host.PreflightReport{
		KVMAvailable:           true,
		NetworkPolicyAvailable: true,
		IPv4ForwardingEnabled:  true,
		HostToolsAvailable:     true,
		JailCgroupAvailable:    true,
		SystemdAvailable:       true,
	}
}

func TestRequireHostAcceptsCompleteHost(t *testing.T) {
	if err := RequireHost(readyHostReport()); err != nil {
		t.Fatalf("complete host was rejected: %v", err)
	}
}

func TestRequireHostReportsEveryUnmetRequirement(t *testing.T) {
	report := readyHostReport()
	report.IPv4ForwardingEnabled = false
	report.HostToolsAvailable = false
	report.Warnings = []string{"mkfs.ext4 was not found"}
	err := RequireHost(report)
	if err == nil {
		t.Fatal("incomplete host was accepted")
	}
	for _, expected := range []string{"IPv4 forwarding is disabled", "e2fsprogs", "mkfs.ext4 was not found"} {
		if !strings.Contains(err.Error(), expected) {
			t.Fatalf("error %q does not mention %q", err, expected)
		}
	}
}

func TestRequireHostRefusesHostsWithoutVMConfinement(t *testing.T) {
	for name, disable := range map[string]func(*host.PreflightReport){
		"cgroup controllers": func(report *host.PreflightReport) { report.JailCgroupAvailable = false },
		"systemd":            func(report *host.PreflightReport) { report.SystemdAvailable = false },
	} {
		report := readyHostReport()
		disable(&report)
		if err := RequireHost(report); err == nil {
			t.Fatalf("host without %s was accepted", name)
		}
	}
}
