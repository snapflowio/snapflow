// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package text

import (
	"fmt"
	"strings"
	"time"
)

const (
	EarningTitle         = "Earning"
	EarningService       = "Snapflow service"
	EarningConnection    = "Control plane"
	EarningQualification = "Qualification"
	EarningListing       = "Marketplace listing"
	EarningPayouts       = "Payouts"
	EarningRelease       = "Snapflow release"
	EarningReady         = "Ready to earn: online, qualified, listed and paid out to a ready wallet"
	EarningOpenPrefix    = "open "
	EarningFixJoiner     = ": "
	FixSeparator         = " "
)

const (
	ServiceFix            = "start it with `sudo systemctl enable --now snapflow`; `journalctl -u snapflow -e` shows why it stopped"
	ServiceBootFix        = "run `sudo systemctl enable snapflow` so it starts again after a reboot"
	ServiceNoBoot         = "running, but does not start on boot"
	DevelopmentServiceFix = "run `" + DevelopmentServeTask + "`"

	ConnectionUnknown     = "not checked; the machine has no readable enrollment"
	ConnectionFixHealth   = "check the Snapflow service above and this machine's internet access"
	ConnectionFixDisabled = "the machine page explains why Snapflow disabled it"
	ConnectionFixFailed   = "run `sudo snapflow doctor` and fix each failed check"

	UnknownWhileOffline = "unknown while the control plane is unreachable"

	QualificationWaiting    = "connected; the benchmark starts shortly"
	QualificationConnecting = "waiting for the machine's first connection"
	QualificationRunning    = "the benchmark is running"
	QualificationApproval   = "the benchmark passed; waiting for Snapflow to approve the machine"
	QualificationPassed     = "benchmarked and approved"
	QualificationBenchmark  = "the benchmark failed"
	QualificationDeferred   = "the benchmark was deferred"
	QualificationRenewal    = "the benchmark renewal was deferred"
	QualificationExpired    = "the passed benchmark expired, so the machine is no longer listed"
	QualificationRenewFix   = "keep the machine free of sandboxes for a while so Snapflow can renew the benchmark, or run it now on the Health page"
	QualificationFailed     = "the machine failed its readiness checks"
	QualificationRestricted = "Snapflow restricted this machine"
	QualificationRetired    = "the machine was decommissioned"
	QualificationStopped    = "the machine stopped responding"
	QualificationDoctorFix  = "run `sudo snapflow doctor` to see each failed requirement and its fix, then retry the benchmark on the Health page"
	QualificationTrustFix   = "the Trust page shows the restriction and when it ends"
	QualificationNoAction   = "nothing to do; approval usually follows a passed benchmark"

	benchmarkRetryPrefix   = "retrying automatically at "
	benchmarkExpiresPrefix = "the benchmark expires at "
	benchmarkTimeLayout    = "2006-01-02 15:04 MST"

	ListingNotYet  = "available once the machine is benchmarked and approved"
	ListingMissing = "no listing yet"
	ListingDraft   = "the listing is a draft, so customers cannot rent this machine"
	ListingPaused  = "the listing is paused, so customers cannot rent this machine"
	ListingFix     = "set a price and publish the listing"
	ListingResume  = "resume the listing"

	PayoutsNotSetUp = "no payout wallet is set up, so earnings cannot be paid out"
	PayoutsBlocked  = "the payout wallet cannot receive earnings"
	PayoutsFix      = "add a payout wallet"
	PayoutsReview   = "review the payout wallet"

	ReleaseUpdateFailed = "the last update failed: "
	ReleaseReinstallFix = "rerun `sudo snapflow enroll`; it reinstalls the verified release and keeps the enrollment"
	ReleaseUpdateFix    = "the Software page shows the update history; the update timer retries in the next maintenance window"
)

const (
	nounStep        = "step"
	nounItem        = "item"
	pluralSuffix    = "s"
	singularSubject = 1
)

func EarningBlocked(failed, waiting int) string {
	switch {
	case failed == 0:
		return fmt.Sprintf("Not earning yet: waiting on %s", plural(waiting, nounStep))
	case waiting == 0:
		return fmt.Sprintf("Not earning: %s need%s attention", plural(failed, nounItem), verbSuffix(failed))
	default:
		return fmt.Sprintf("Not earning: %s need%s attention, %s still in progress",
			plural(failed, nounItem), verbSuffix(failed), plural(waiting, nounStep))
	}
}

func plural(count int, noun string) string {
	if count == singularSubject {
		return fmt.Sprintf("%d %s", count, noun)
	}
	return fmt.Sprintf("%d %s%s", count, noun, pluralSuffix)
}

func verbSuffix(count int) string {
	if count == singularSubject {
		return pluralSuffix
	}
	return ""
}

func ServiceState(unit, active, sub string) string {
	return fmt.Sprintf("%s is %s (%s)", unit, active, sub)
}

func ConnectionFix(apiURL string) string {
	return "check this machine's internet access, DNS and any proxy or firewall rule for " + apiURL
}

func FailedRequirements(names []string) string {
	return "failed required checks: " + strings.Join(names, ListSeparator)
}

func ListingSummary(visibility, tier string) string {
	return fmt.Sprintf("listed, %s, %s tier", visibility, tier)
}

func PayoutsReady(hostAddress string) string {
	return "payout wallet ready; payment channels pay host key " + hostAddress
}

func ReleaseSummary(version string) string {
	return version + DetailSeparator + ReleaseVerified
}

func WithReason(summary, reason string) string {
	if reason == "" {
		return summary
	}
	return summary + DetailSeparator + reason
}

func WithReasons(summary string, reasons []string) string {
	return WithReason(summary, strings.Join(reasons, ListSeparator))
}

func BenchmarkDeferred(lead, summary string, retryAt *time.Time) string {
	detail := WithReason(lead, summary)
	if retryAt == nil {
		return detail
	}
	return WithReason(detail, benchmarkRetryPrefix+retryAt.Local().Format(benchmarkTimeLayout))
}

func BenchmarkExpires(summary string, expiresAt *time.Time) string {
	if expiresAt == nil {
		return summary
	}
	return WithReason(summary, benchmarkExpiresPrefix+expiresAt.Local().Format(benchmarkTimeLayout))
}
