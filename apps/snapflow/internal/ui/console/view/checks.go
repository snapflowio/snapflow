// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package view

import (
	"fmt"
	"strings"
	"time"

	"github.com/snapflowio/snapflow/internal/agent/doctor"
	"github.com/snapflowio/snapflow/internal/ui/cli/text"
)

const (
	checkTitleWidth  = 26
	checkStatusWidth = 6
	statusPassed     = "ok"
	statusFailed     = "FAIL"
	statusPending    = "warn"
	detailJoiner     = "; "
	bytesPerMebibyte = 1024 * 1024
)

func checkTitles() map[string]string {
	return map[string]string{
		doctor.CheckKVM:                 text.CheckKVM,
		doctor.CheckNetworkPolicy:       text.CheckNetworkPolicy,
		doctor.CheckIPv4Forwarding:      text.CheckIPv4Forwarding,
		doctor.CheckHostTools:           text.CheckHostTools,
		doctor.CheckVMLimits:            text.CheckVMLimits,
		doctor.CheckSystemd:             text.CheckSystemd,
		doctor.CheckStorage:             text.CheckStorage,
		doctor.CheckReflink:             text.CheckReflink,
		doctor.CheckLandlock:            text.CheckLandlock,
		doctor.CheckKSM:                 text.CheckKSM,
		doctor.CheckCPUMitigations:      text.CheckCPUMitigations,
		doctor.CheckGPUDiscovery:        text.CheckGPUDiscovery,
		doctor.CheckIOMMU:               text.CheckIOMMU,
		doctor.CheckNvidiaModeset:       text.CheckNvidiaModeset,
		doctor.CheckPersistenced:        text.CheckPersistenced,
		doctor.CheckVFIO:                text.CheckVFIO,
		doctor.CheckGPUScrubTools:       text.CheckGPUScrubTools,
		doctor.CheckIsolationProbe:      text.CheckIsolationProbe,
		doctor.CheckRelease:             text.CheckRelease,
		doctor.CheckReadinessContract:   text.CheckReadinessContract,
		doctor.CheckRegistration:        text.CheckRegistration,
		doctor.CheckProfileControlPlane: text.CheckProfileControlPlane,
		doctor.CheckAPI:                 text.CheckAPI,
		doctor.CheckGuestRegistry:       text.CheckGuestRegistry,
		doctor.CheckEdge:                text.CheckEdge,
		doctor.CheckBenchmark:           text.CheckBenchmark,
	}
}

func CheckTitle(name string) string {
	if title, found := checkTitles()[name]; found {
		return title
	}
	return name
}

func Check(check doctor.DiagnosticCheck) string {
	return checkLine(check.Status, CheckTitle(check.Name), check.Detail, check.Remediation)
}

func checkLine(status doctor.CheckStatus, title, detail, fix string) string {
	line := indent + fmt.Sprintf("%-*s%-*s", checkStatusWidth, checkStatus(status), checkTitleWidth, title) +
		strings.ReplaceAll(detail, newline, detailJoiner)
	if status == doctor.CheckPassed || fix == "" {
		return line
	}
	return line + newline + indent + strings.Repeat(" ", checkStatusWidth) + hintLine(fix)
}

func DiagnosisSummary(report doctor.Diagnosis) string {
	failed := 0
	for _, check := range report.Checks {
		if check.Status == doctor.CheckFailed {
			failed++
		}
	}
	if failed == 0 {
		return Success(text.DoctorReady)
	}
	return Failure(text.DoctorFailed(failed), text.DoctorFailedHint)
}

func Benchmark(report doctor.BenchmarkReport) string {
	return Lines(
		text.BenchmarkTitle,
		Row(text.LabelSamples, fmt.Sprint(report.Samples)),
		Row(text.LabelVerification, durations(report.ReleaseVerificationNanos)),
		Row(text.LabelStorageWrite, rates(report.StorageWriteBytesPerSec)),
		Row(text.LabelStorageRead, rates(report.StorageReadBytesPerSec)),
		Row(text.LabelAPILatency, durations(report.APIHealthLatencyNanos)),
	)
}

func durations(values doctor.Distribution) string {
	return text.Percentiles(time.Duration(values.P50).String(), time.Duration(values.P95).String(),
		time.Duration(values.P99).String())
}

func rates(values doctor.Distribution) string {
	return text.Percentiles(text.MebibytesPerSecond(values.P50/bytesPerMebibyte),
		text.MebibytesPerSecond(values.P95/bytesPerMebibyte), text.MebibytesPerSecond(values.P99/bytesPerMebibyte))
}

func checkStatus(status doctor.CheckStatus) string {
	switch status {
	case doctor.CheckPassed:
		return statusPassed
	case doctor.CheckFailed:
		return statusFailed
	default:
		return statusPending
	}
}
