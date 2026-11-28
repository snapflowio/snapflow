// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package local

import (
	"slices"
	"strings"

	"github.com/snapflowio/snapflow/internal/agent/doctor"
	"github.com/snapflowio/snapflow/internal/foundation/config"
	"github.com/snapflowio/snapflow/internal/foundation/system"
	"github.com/snapflowio/snapflow/internal/install"
	"github.com/snapflowio/snapflow/internal/ui/cli/text"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	EarningService       = "service"
	EarningConnection    = "connection"
	EarningQualification = "qualification"
	EarningListing       = "listing"
	EarningPayouts       = "payouts"
	EarningRelease       = "release"
)

type EarningCheck struct {
	Name   string             `json:"name"`
	Status doctor.CheckStatus `json:"status"`
	Detail string             `json:"detail"`
	Fix    string             `json:"fix,omitempty"`
	FixURL string             `json:"fixUrl,omitempty"`
}

type earningInputs struct {
	result  *StatusResult
	profile config.Profile
	pages   dashboardPages
	machine *apiclient.MachineIdentityStatus
}

func (result *StatusResult) inspectEarning(profile config.Profile) {
	inputs := earningInputs{
		result: result, profile: profile, machine: result.ControlPlane,
		pages: newDashboardPages(profile, result.Registration.MachineID),
	}
	result.MachineURL = inputs.pages.machine()
	if !result.Registration.Registered {
		result.MachineURL = inputs.pages.addMachine()
	}
	result.Earning = []EarningCheck{
		inputs.service(), inputs.release(), inputs.connection(),
		inputs.qualification(), inputs.listing(), inputs.payouts(),
	}
	result.EarningReady = true
	for _, check := range result.Earning {
		if check.Status != doctor.CheckPassed {
			result.EarningReady = false
		}
	}
}

func passed(name, detail string) EarningCheck {
	return EarningCheck{Name: name, Status: doctor.CheckPassed, Detail: detail}
}

func waiting(name, detail string) EarningCheck {
	return EarningCheck{Name: name, Status: doctor.CheckPending, Detail: detail}
}

func blocked(name, detail, fix, fixURL string) EarningCheck {
	return EarningCheck{Name: name, Status: doctor.CheckFailed, Detail: detail, Fix: fix, FixURL: fixURL}
}

func (inputs earningInputs) serviceFix() string {
	if inputs.profile.Name == config.Development {
		return text.DevelopmentServiceFix
	}
	return text.ServiceFix
}

func (inputs earningInputs) service() EarningCheck {
	if status := inputs.result.Service; status != nil && !status.Active {
		return blocked(EarningService, text.ServiceState(system.ServiceUnit, status.ActiveState, status.SubState),
			inputs.serviceFix(), "")
	}
	daemon := inputs.result.Daemon
	if !daemon.Reachable {
		return blocked(EarningService, daemon.Error, inputs.serviceFix(), "")
	}
	if status := inputs.result.Service; status != nil && !status.Enabled {
		return EarningCheck{
			Name: EarningService, Status: doctor.CheckPending, Detail: text.ServiceNoBoot, Fix: text.ServiceBootFix,
		}
	}
	return passed(EarningService, text.DaemonVersion(daemon.Version))
}

func (inputs earningInputs) release() EarningCheck {
	status := inputs.result.Release
	if !status.Verified {
		detail := status.VerificationError
		if status.Active == nil {
			detail = text.WithReason(text.ReleaseMissing, detail)
		}
		return blocked(EarningRelease, detail, text.ReleaseReinstallFix, inputs.pages.software())
	}
	if update := inputs.result.Update; update.Phase == install.UpdatePhaseFailed {
		return blocked(EarningRelease, text.ReleaseUpdateFailed+update.LastFailure, text.ReleaseUpdateFix,
			inputs.pages.software())
	}
	return passed(EarningRelease, text.ReleaseSummary(status.VerifiedVersion))
}

func (inputs earningInputs) connection() EarningCheck {
	registration := inputs.result.Registration
	if registration.NeedsEnrollment {
		return blocked(EarningConnection, registration.Error, text.ReenrollHint, inputs.pages.addMachine())
	}
	machine := inputs.machine
	if machine == nil {
		if !registration.Registered {
			return waiting(EarningConnection, text.ConnectionUnknown)
		}
		return blocked(EarningConnection, text.WithReason(text.StateUnreachable, inputs.result.ControlPlaneError),
			text.ConnectionFix(registration.ControlPlane), "")
	}
	reason := optionalText(machine.ReadinessReason)
	switch machine.State {
	case apiclient.MachineStateReady:
		return passed(EarningConnection, text.StateReady)
	case apiclient.MachineStateInitializing:
		return waiting(EarningConnection, text.WithReason(text.StateInitializing, reason))
	case apiclient.MachineStateDraining:
		return waiting(EarningConnection, text.StateDraining)
	case apiclient.MachineStateUnresponsive:
		return blocked(EarningConnection, text.StateUnresponsive, text.ConnectionFixHealth, inputs.pages.health())
	case apiclient.MachineStateDisabled:
		return blocked(EarningConnection, text.WithReason(text.StateDisabled, reason), text.ConnectionFixDisabled,
			inputs.pages.machine())
	case apiclient.MachineStateDecommissioned:
		return blocked(EarningConnection, text.StateDecommissioned, text.ReenrollHint, inputs.pages.addMachine())
	case apiclient.MachineStateFailed:
		return blocked(EarningConnection, text.WithReason(text.StateFailed, reason), text.ConnectionFixFailed,
			inputs.pages.health())
	default:
		return waiting(EarningConnection, text.StateUnknown)
	}
}

func (inputs earningInputs) qualification() EarningCheck {
	machine := inputs.machine
	if machine == nil {
		return waiting(EarningQualification, text.UnknownWhileOffline)
	}
	reason := optionalText(machine.ReadinessReason)
	failing := failedRequirements(machine.Diagnostics)
	switch machine.EnrollmentPhase {
	case apiclient.MachineEnrollmentPhaseConnecting:
		return waiting(EarningQualification, text.QualificationConnecting)
	case apiclient.MachineEnrollmentPhaseConnected:
		return inputs.qualifying(waiting(EarningQualification, text.QualificationWaiting), failing)
	case apiclient.MachineEnrollmentPhaseBenchmarking:
		return inputs.qualifying(waiting(EarningQualification, text.QualificationRunning), failing)
	case apiclient.MachineEnrollmentPhaseBenchmarkDeferred:
		return inputs.qualifying(inputs.benchmarkDeferred(), failing)
	case apiclient.MachineEnrollmentPhaseAwaitingApproval:
		return EarningCheck{
			Name: EarningQualification, Status: doctor.CheckPending, Detail: text.QualificationApproval,
			Fix: text.QualificationNoAction,
		}
	case apiclient.MachineEnrollmentPhaseReadyToList, apiclient.MachineEnrollmentPhaseListed:
		return inputs.qualifying(inputs.benchmarkPassed(), failing)
	case apiclient.MachineEnrollmentPhaseBenchmarkFailed:
		return inputs.benchmarkFailed(reason, failing)
	case apiclient.MachineEnrollmentPhaseBenchmarkExpired:
		return blocked(EarningQualification, text.QualificationExpired, text.QualificationRenewFix, inputs.pages.health())
	case apiclient.MachineEnrollmentPhaseRestricted:
		return blocked(EarningQualification, text.WithReason(text.QualificationRestricted, reason),
			text.QualificationTrustFix, inputs.pages.trust())
	case apiclient.MachineEnrollmentPhaseUnresponsive:
		return blocked(EarningQualification, text.QualificationStopped, text.ConnectionFixHealth, inputs.pages.health())
	case apiclient.MachineEnrollmentPhaseDecommissioned:
		return blocked(EarningQualification, text.QualificationRetired, text.ReenrollHint, inputs.pages.addMachine())
	default:
		return inputs.qualificationFailed(text.QualificationFailed, reason, failing)
	}
}

func (inputs earningInputs) qualifying(progress EarningCheck, failing []string) EarningCheck {
	if len(failing) > 0 {
		return inputs.qualificationFailed(progress.Detail, "", failing)
	}
	return progress
}

func (inputs earningInputs) qualificationFailed(summary, reason string, failing []string) EarningCheck {
	detail := text.WithReason(summary, reason)
	if len(failing) > 0 {
		detail = text.WithReason(detail, text.FailedRequirements(failing))
	}
	return blocked(EarningQualification, detail, text.QualificationDoctorFix, inputs.pages.health())
}

func (inputs earningInputs) latestBenchmark() *apiclient.MachineBenchmark {
	if inputs.machine == nil || inputs.machine.Marketplace == nil {
		return nil
	}
	return inputs.machine.Marketplace.LatestBenchmark
}

func (inputs earningInputs) benchmarkDeferred() EarningCheck {
	benchmark := inputs.latestBenchmark()
	if benchmark == nil || benchmark.Deferral == nil {
		return waiting(EarningQualification, text.QualificationDeferred)
	}
	return EarningCheck{
		Name: EarningQualification, Status: doctor.CheckPending,
		Detail: text.BenchmarkDeferred(text.QualificationDeferred, benchmark.Deferral.Summary, benchmark.NextAttemptAt),
		Fix:    benchmark.Deferral.Fix,
	}
}

func (inputs earningInputs) benchmarkPassed() EarningCheck {
	detail := text.QualificationPassed
	if marketplace := inputs.machine.Marketplace; marketplace != nil {
		detail = text.BenchmarkExpires(detail, marketplace.BenchmarkExpiresAt)
	}
	benchmark := inputs.latestBenchmark()
	if benchmark == nil || benchmark.Deferral == nil {
		return passed(EarningQualification, detail)
	}
	return EarningCheck{
		Name: EarningQualification, Status: doctor.CheckPassed,
		Detail: text.WithReason(detail,
			text.BenchmarkDeferred(text.QualificationRenewal, benchmark.Deferral.Summary, benchmark.NextAttemptAt)),
		Fix: benchmark.Deferral.Fix,
	}
}

func (inputs earningInputs) benchmarkFailed(reason string, failing []string) EarningCheck {
	benchmark := inputs.latestBenchmark()
	if benchmark == nil || len(benchmark.Failures) == 0 {
		return inputs.qualificationFailed(text.QualificationBenchmark, reason, failing)
	}
	summaries := make([]string, 0, len(benchmark.Failures))
	fixes := make([]string, 0, len(benchmark.Failures))
	for _, failure := range benchmark.Failures {
		summaries = append(summaries, failure.Summary)
		if !slices.Contains(fixes, failure.Fix) {
			fixes = append(fixes, failure.Fix)
		}
	}
	return blocked(EarningQualification, text.WithReasons(text.QualificationBenchmark, summaries),
		strings.Join(fixes, text.FixSeparator), inputs.pages.health())
}

func failedRequirements(diagnostics *apiclient.MachineDiagnostics) []string {
	if diagnostics == nil {
		return nil
	}
	var failing []string
	for _, check := range diagnostics.Checks {
		if check.Required && check.Status == apiclient.MachineDiagnosticStatusFailed {
			failing = append(failing, check.Name)
		}
	}
	return failing
}

func (inputs earningInputs) listing() EarningCheck {
	machine := inputs.machine
	if machine == nil {
		return waiting(EarningListing, text.UnknownWhileOffline)
	}
	if machine.EnrollmentPhase != apiclient.MachineEnrollmentPhaseReadyToList &&
		machine.EnrollmentPhase != apiclient.MachineEnrollmentPhaseListed {
		return waiting(EarningListing, text.ListingNotYet)
	}
	marketplace := machine.Marketplace
	if marketplace == nil {
		return blocked(EarningListing, text.ListingMissing, text.ListingFix, inputs.pages.listing())
	}
	switch marketplace.ListingState {
	case apiclient.ListingStateListed:
		return passed(EarningListing, text.WithReasons(
			text.ListingSummary(string(marketplace.Visibility), string(marketplace.Tier)), marketplace.Reasons,
		))
	case apiclient.ListingStatePaused:
		return blocked(EarningListing, text.WithReasons(text.ListingPaused, marketplace.Reasons), text.ListingResume,
			inputs.pages.listing())
	default:
		return blocked(EarningListing, text.WithReasons(text.ListingDraft, marketplace.Reasons), text.ListingFix,
			inputs.pages.listing())
	}
}

func (inputs earningInputs) payouts() EarningCheck {
	machine := inputs.machine
	if machine == nil {
		return waiting(EarningPayouts, text.UnknownWhileOffline)
	}
	switch machine.Payouts {
	case apiclient.PayoutReadinessReady:
		return passed(EarningPayouts, text.PayoutsReady(inputs.result.Registration.HostAddress))
	case apiclient.PayoutReadinessBlocked:
		return blocked(EarningPayouts, text.PayoutsBlocked, text.PayoutsReview, inputs.pages.payouts())
	default:
		return blocked(EarningPayouts, text.PayoutsNotSetUp, text.PayoutsFix, inputs.pages.payouts())
	}
}

func optionalText(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
