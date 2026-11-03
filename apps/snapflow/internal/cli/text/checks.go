// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package text

import "fmt"

const (
	CheckKVM                 = "KVM virtualization"
	CheckNetworkPolicy       = "nftables network policy"
	CheckIPv4Forwarding      = "IPv4 forwarding"
	CheckHostTools           = "Filesystem tools"
	CheckVMLimits            = "VM resource limits"
	CheckSystemd             = "systemd scopes"
	CheckStorage             = "Disk space"
	CheckReflink             = "Copy-on-write clones"
	CheckRelease             = "Verified release"
	CheckReadinessContract   = "Readiness contract"
	CheckRegistration        = "Registration"
	CheckProfileControlPlane = "Control-plane profile"
	CheckAPI                 = "Snapflow API"
	CheckGuestRegistry       = "Guest image registry"
	CheckEdge                = "Edge"
	CheckBenchmark           = "Benchmark"

	DoctorTitle = "Machine doctor"
	DoctorReady = "All required checks passed"
)

func DoctorFailed(failed int) string {
	if failed == 1 {
		return "1 required check failed"
	}
	return fmt.Sprintf("%d required checks failed", failed)
}
