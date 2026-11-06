// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package text

import (
	"fmt"
	"strconv"
	"time"
)

const (
	LabelState        = "State"
	LabelScheduling   = "Scheduling"
	LabelSandboxes    = "Sandboxes"
	LabelCPU          = "CPU"
	LabelMemory       = "Memory"
	LabelDisk         = "Disk"
	LabelGPU          = "GPU"
	LabelHealth       = "Health"
	LabelDaemon       = "Daemon"
	LabelService      = "Service"
	LabelRelease      = "Release"
	LabelUpdates      = "Updates"
	LabelEarnings     = "Earnings"
	LabelPayouts      = "Payouts"
	LabelLocation     = "Location"
	LabelMarketplace  = "Marketplace"
	LabelBenchmark    = "Benchmark"
	LabelTierNotes    = "Tier notes"
	LabelMachine      = "Machine"
	LabelOrganization = "Organization"
	LabelAPI          = "Control plane"
)

const (
	StateReady          = "Online"
	StateInitializing   = "Starting up"
	StateDraining       = "Draining — finishing sandboxes before maintenance"
	StateFailed         = "Failed"
	StateDisabled       = "Disabled by Snapflow"
	StateDecommissioned = "Decommissioned"
	StateUnresponsive   = "Unresponsive — the control plane has not heard from it recently"
	StateUnknown        = "Unknown to the control plane"
)

const (
	SchedulingAccepting  = "Accepting new sandboxes"
	SchedulingQualifying = "Not yet schedulable — qualification in progress"
	SchedulingDraining   = "Not accepting new sandboxes while draining"
	DaemonUnreachable    = "not reachable"
	ServiceActiveEnabled = "active · starts on boot"
	ServiceInactive      = "not running"
	ServiceDisabled      = "does not start on boot"
	ReleaseVerified      = "verified"
	ReleaseUnverified    = "not verified"
	ReleaseMissing       = "no release installed"
	EarningsDashboard    = "earnings are in the dashboard"
	PayoutsReady         = "ready; customers' signed USDC vouchers pay your linked wallet"
	PayoutsBlocked       = "blocked; the linked payout wallet cannot receive earnings, open Earnings → Payouts in the dashboard"
	PayoutsNotSetUp      = "not set up; link a payout wallet in Earnings → Payouts in the dashboard to get paid"
	PayoutsUnknown       = "unknown; check Earnings → Payouts in the dashboard"
	LocationPending      = "unknown; detected from the public IP address the machine connects from"
	LocationSeparator    = ", "
	NotRegisteredTitle   = "This machine is not registered with Snapflow yet"
	RecentErrorsTitle    = "Recent service errors"
	ProblemsTitle        = "Needs attention"
	HealthNoReports      = "no service reports yet"
	ListSeparator        = ", "
	DetailSeparator      = " · "
)

func SandboxCount(count int) string {
	if count == 1 {
		return "1 running"
	}
	return fmt.Sprintf("%d running", count)
}

func Allocated(allocated, total float32, unit string) string {
	return fmt.Sprintf("%g of %g %s allocated", allocated, total, unit)
}

func UpdateSummary(phase, channel, window string) string {
	return fmt.Sprintf("%s · %s channel · maintenance window %s", phase, channel, window)
}

func DaemonVersion(version string) string {
	return fmt.Sprintf("%s %s answering", Daemon, version)
}

const (
	UnitVCPU = "vCPU"
	UnitGiB  = "GiB"
)

func WatchFooter(interval time.Duration) string {
	return fmt.Sprintf("refreshing every %s · q to quit", interval)
}

const (
	WatchNeedsTerminal  = "--watch needs an interactive terminal"
	WatchHint           = "run `sudo snapflow status` for a single snapshot, or --json for scripts"
	DevelopmentService  = "the development daemon does not run as a system service"
	DevelopmentHint     = "use the Moon task " + DevelopmentServeTask + "; it installs the release and enrolls the machine when needed"
	UpdateAvailable     = "Update available"
	UpdateCurrent       = "This machine is up to date"
	UpdateAppliedTitle  = "Update applied and the machine is ready"
	RollbackDoneTitle   = "Rolled back to the previous release and the machine is ready"
	UninstallDoneTitle  = "Snapflow services stopped and disabled"
	UninstallPurged     = "Snapflow state erased"
	ServiceStartedTitle = "Snapflow service started"
	ServiceStoppedTitle = "Snapflow service stopped"
	LabelInstalled      = "Installed"
	LabelAvailable      = "Available"
	LabelChannel        = "Channel"
)

func UpdateHint(profile string) string {
	return Run(ProfileCommand(CommandUpdate, profile))
}

const (
	ReleaseResetDevelopmentOnly = "release reset is restricted to the development profile"
	SystemFilesProductionOnly   = "system files are installed only for the production profile"
	SystemFilesShort            = "Install the active release's systemd units and system configuration"
	ReleaseVerifiedTitle        = "The active release is verified"
	ReleaseInstalledTitle       = "Release installed and verified"
	ReleaseResetDone            = "Development release state removed"
	ReleaseNone                 = "none"
	LabelDigest                 = "Digest"
	LabelActive                 = "Active"
	LabelPrevious               = "Previous"
	LabelStaging                = "Staging"
	LabelSamples                = "Samples"
	LabelVerification           = "Release verification"
	LabelStorageWrite           = "Storage write"
	LabelStorageRead            = "Storage read"
	LabelAPILatency             = "API latency"
)

func ReleaseGarbageRemoved(count int) string {
	if count == 1 {
		return "Removed 1 inactive release item"
	}
	return fmt.Sprintf("Removed %d inactive release items", count)
}

func Count(value int) string {
	return strconv.Itoa(value)
}

func Percentiles(p50, p95, p99 string) string {
	return fmt.Sprintf("p50 %s · p95 %s · p99 %s", p50, p95, p99)
}

func MebibytesPerSecond(value int64) string {
	return fmt.Sprintf("%d MiB/s", value)
}

const (
	TierPrivate              = "Private"
	TierCommunity            = "Community"
	TierVerified             = "Verified"
	TierDatacenter           = "Datacenter"
	ListingDraft             = "draft"
	ListingListed            = "listed"
	ListingPaused            = "paused"
	VisibilityPrivate        = "private"
	VisibilityPublic         = "public"
	BenchmarkPassed          = "passed"
	BenchmarkPending         = "in progress"
	BenchmarkFailed          = "failed"
	BenchmarkExpired         = "expired"
	BenchmarkNone            = "not benchmarked yet"
	MarketplaceNotRegistered = "not on the marketplace yet"
	MarketplaceUnknown       = "unknown"
)

func MarketplaceSummary(tier, listing, visibility string) string {
	return fmt.Sprintf("%s tier · %s · %s", tier, listing, visibility)
}
