// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package hostreport

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/snapflow/internal/agent/doctor"
	"github.com/snapflowio/snapflow/internal/foundation/state"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const maximumTextRunes = 2048

func apiDiagnosticStatuses() map[doctor.CheckStatus]apiclient.MachineDiagnosticStatus {
	return map[doctor.CheckStatus]apiclient.MachineDiagnosticStatus{
		doctor.CheckPassed:  apiclient.MachineDiagnosticStatusOk,
		doctor.CheckPending: apiclient.MachineDiagnosticStatusPending,
		doctor.CheckFailed:  apiclient.MachineDiagnosticStatusFailed,
	}
}

func DiagnosticsReport(diagnosis doctor.Diagnosis, checkedAt time.Time) (apiclient.MachineDiagnostics, error) {
	statuses := apiDiagnosticStatuses()
	checks := make([]apiclient.MachineDiagnosticCheck, 0, len(diagnosis.Checks))
	for _, check := range diagnosis.Checks {
		status, found := statuses[check.Status]
		if !found {
			return apiclient.MachineDiagnostics{}, fmt.Errorf("unsupported doctor check status %q", check.Status)
		}
		reported := apiclient.MachineDiagnosticCheck{
			Name: check.Name, Status: status, Required: check.Required, Detail: truncate(check.Detail),
		}
		if check.Remediation != "" {
			remediation := truncate(check.Remediation)
			reported.Remediation = &remediation
		}
		checks = append(checks, reported)
	}
	return apiclient.MachineDiagnostics{Ready: diagnosis.Ready, Checks: checks, CheckedAt: checkedAt.UTC()}, nil
}

func PaymentHoldsReport(holds []state.SandboxPaymentHold, observedAt time.Time) (apiclient.MachinePaymentHolds, error) {
	reported := make([]apiclient.MachinePaymentHold, 0, len(holds))
	for _, hold := range holds {
		reason := apiclient.MachinePaymentHoldReason(hold.Reason)
		if !reason.Valid() {
			return apiclient.MachinePaymentHolds{}, fmt.Errorf("sandbox %s is held for unknown reason %q", hold.SandboxID, hold.Reason)
		}
		sandboxID, err := uuid.Parse(hold.SandboxID)
		if err != nil {
			return apiclient.MachinePaymentHolds{}, fmt.Errorf("held sandbox id %q: %w", hold.SandboxID, err)
		}
		reported = append(reported, apiclient.MachinePaymentHold{
			SandboxId: sandboxID, Reason: reason, Detail: truncate(hold.Detail), HeldAt: hold.HeldAt.UTC(),
		})
	}
	return apiclient.MachinePaymentHolds{Holds: reported, ObservedAt: observedAt.UTC()}, nil
}

func BenchmarkReport(report doctor.BenchmarkReport) apiclient.MachineLocalBenchmark {
	return apiclient.MachineLocalBenchmark{
		Schema:                     report.Schema,
		RecordedAt:                 report.RecordedAt.UTC(),
		Architecture:               report.Architecture,
		Kernel:                     report.Kernel,
		LogicalCpus:                report.LogicalCPUs,
		Samples:                    report.Samples,
		ReleaseVersion:             report.ReleaseVersion,
		ReleaseBundleDigest:        report.ReleaseBundleDigest,
		ReleaseAssetBytes:          report.ReleaseAssetBytes,
		CacheState:                 report.CacheState,
		ReleaseVerificationNanos:   distribution(report.ReleaseVerificationNanos),
		StorageWriteBytesPerSecond: distribution(report.StorageWriteBytesPerSec),
		StorageReadBytesPerSecond:  distribution(report.StorageReadBytesPerSec),
		ApiHealthLatencyNanos:      distribution(report.APIHealthLatencyNanos),
	}
}

func distribution(measured doctor.Distribution) apiclient.MachineMeasurementDistribution {
	return apiclient.MachineMeasurementDistribution{P50: measured.P50, P95: measured.P95, P99: measured.P99}
}

func truncate(text string) string {
	runes := []rune(text)
	if len(runes) <= maximumTextRunes {
		return text
	}
	return string(runes[:maximumTextRunes])
}
