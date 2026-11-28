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
	CheckLandlock            = "Landlock sandboxing"
	CheckKSM                 = "Kernel same-page merging"
	CheckCPUMitigations      = "CPU mitigations"
	CheckGPUDiscovery        = "GPU discovery"
	CheckIOMMU               = "GPU IOMMU groups"
	CheckNvidiaModeset       = "NVIDIA modesetting"
	CheckPersistenced        = "NVIDIA persistence daemon"
	CheckVFIO                = "vfio-pci driver"
	CheckGPUScrubTools       = "GPU scrub tools"
	CheckIsolationProbe      = "Isolation probe"
	CheckRelease             = "Verified release"
	CheckReadinessContract   = "Readiness contract"
	CheckRegistration        = "Enrollment"
	CheckProfileControlPlane = "Control-plane profile"
	CheckAPI                 = "Snapflow API"
	CheckGuestRegistry       = "Guest image registry"
	CheckEdge                = "Edge"
	CheckBenchmark           = "Benchmark"

	DoctorTitle      = "Machine doctor"
	DoctorReady      = "All required checks passed"
	DoctorFailedHint = "apply the fix under each FAIL line, then rerun `sudo snapflow doctor`"

	BenchmarkTitle    = "Benchmark"
	LabelSamples      = "Samples"
	LabelVerification = "Verification"
	LabelStorageWrite = "Storage write"
	LabelStorageRead  = "Storage read"
	LabelAPILatency   = "API latency"
)

func DoctorFailed(failed int) string {
	if failed == 1 {
		return "1 required check failed"
	}
	return fmt.Sprintf("%d required checks failed", failed)
}

func Percentiles(p50, p95, p99 string) string {
	return fmt.Sprintf("p50 %s, p95 %s, p99 %s", p50, p95, p99)
}

func MebibytesPerSecond(value int64) string {
	return fmt.Sprintf("%d MiB/s", value)
}
