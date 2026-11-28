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
)

const (
	StatusTitle       = "Machine status"
	LabelMachine      = "Machine"
	LabelOrganization = "Organization"
	LabelHostKey      = "Host key"
	LabelAPI          = "Control plane"
	LabelState        = "State"
	LabelScheduling   = "Scheduling"
	LabelSandboxes    = "Sandboxes"
	LabelCPU          = "CPU"
	LabelMemory       = "Memory"
	LabelDisk         = "Disk"
	LabelHealth       = "Health"
	LabelDaemon       = "Daemon"
	LabelService      = "Service"
	LabelRelease      = "Release"
	LabelUpdates      = "Updates"
	LabelPaymentHolds = "Payment holds"
	LabelDashboard    = "Dashboard"
)

const (
	StateReady          = "online"
	StateInitializing   = "starting up"
	StateDraining       = "draining before maintenance"
	StateFailed         = "failed"
	StateDisabled       = "disabled by Snapflow"
	StateDecommissioned = "decommissioned"
	StateUnresponsive   = "unresponsive; the control plane has not heard from it recently"
	StateUnknown        = "unknown to the control plane"
	StateUnreachable    = "the control plane is unreachable"
)

const (
	SchedulingAccepting  = "accepting new sandboxes"
	SchedulingQualifying = "not yet schedulable; qualification in progress"
	SchedulingDraining   = "not accepting new sandboxes while draining"
	DaemonUnreachable    = "not reachable"
	ServiceActiveEnabled = "active, starts on boot"
	ServiceInactive      = "not running"
	ServiceDisabled      = "does not start on boot"
	ReleaseVerified      = "verified"
	ReleaseUnverified    = "not verified"
	ReleaseMissing       = "no release installed"
	PaymentHoldsNone     = "none"
	UpdatesUnknown       = "no update has run yet"
	NotEnrolledTitle     = "this machine is not enrolled with Snapflow yet"
	RecentErrorsTitle    = "Recent service errors"
	ProblemsTitle        = "Needs attention"
	HealthNoReports      = "no service reports yet"
	ListSeparator        = ", "
	DetailSeparator      = " - "
	UnitVCPU             = "vCPU"
	UnitGiB              = "GiB"
	UnitMiB              = "MiB"
)

const (
	DevelopmentService  = "the development daemon does not run as a system service"
	DevelopmentHint     = "use the Moon task " + DevelopmentServeTask + "; it installs the release and enrolls the machine when needed"
	UninstallDoneTitle  = "Snapflow services stopped and disabled"
	UninstallPurged     = "Snapflow state erased"
	UpdateCurrent       = "This machine is up to date"
	UpdateOutsideWindow = "Outside the maintenance window"
	UpdateAppliedTitle  = "Update applied and the machine is ready"
)

const (
	ReleaseResetDevelopmentOnly = "release reset is restricted to the development profile"
	SystemFilesProductionOnly   = "system files are installed only for the production profile"
	SystemFilesShort            = "Install the active release's systemd units and system configuration"
	ReleaseVerifiedTitle        = "The active release is verified"
	ReleaseInstalledTitle       = "Release installed and verified"
	ReleaseResetDone            = "Development release state removed"
	ReleaseVerifyFailed         = "verify the active Snapflow release"
	ReleaseResetFailed          = "remove the development release state"
	ReleaseInstallFailed        = "install the Snapflow release"
	UninstallStopped            = "uninstall stopped"
	UninstallStoppedHint        = "fix the cause above and rerun the same uninstall command; it is safe to repeat"
	UpdateStopped               = "update stopped"
	UpdateStoppedHint           = "`sudo snapflow status` shows the update state; the update timer retries in the next maintenance window"
)

func SandboxCount(count int) string {
	if count == 1 {
		return "1 running"
	}
	return fmt.Sprintf("%d running", count)
}

func Usage(percent, allocated, total float32, unit string) string {
	return fmt.Sprintf("%.0f%% used, %g of %g %s allocated", percent, allocated, total, unit)
}

func UpdateSummary(phase, channel, window string) string {
	return fmt.Sprintf("%s, %s channel, maintenance window %s", phase, channel, window)
}

func DaemonVersion(version string) string {
	return fmt.Sprintf("%s %s answering", Daemon, version)
}

func PaymentHolds(sandboxIDs []string) string {
	return fmt.Sprintf("%d paused until their customers pay: %s", len(sandboxIDs), strings.Join(sandboxIDs, ListSeparator))
}
