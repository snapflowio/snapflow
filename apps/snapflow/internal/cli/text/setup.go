// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package text

import "fmt"

const (
	PhaseInspection    = "Inspecting this machine"
	PhasePreflight     = "Checking machine requirements"
	PhaseRelease       = "Installing the verified Snapflow release"
	PhaseAuthorization = "Approving this machine"
	PhaseService       = "Starting the Snapflow service"
	PhaseReadiness     = "Waiting for the machine to come online"
)

const (
	NoteReleaseVerified = "already installed and verified"
	NoteAlreadyApproved = "already approved"
)

const (
	SetupTitle = "Machine setup"

	ApprovalTitle       = "Approve this machine"
	ApprovalOpen        = "Open"
	ApprovalConfirm     = "Confirm the code"
	ApprovalScan        = "or scan with your phone"
	ApprovalWaiting     = "Waiting for approval…"
	ApprovalBrowser     = "opened in your browser"
	ApprovalBrowserFail = "could not open a browser; use the link or QR code"
	ApprovalExpired     = "expired"

	DoneTitle                     = "Your machine is live and accepting sandboxes"
	DevelopmentDoneTitle          = "This machine is registered for development"
	NextStepServe                 = "start the development daemon"
	DoneMachine                   = "Machine"
	DoneProfile                   = "Profile"
	DoneDashboard                 = "Dashboard"
	DoneNextSteps                 = "Next steps"
	NextStepWatch                 = "watch it work"
	NextStepLogs                  = "follow the service logs"
	MarketplaceManagedInDashboard = "Pricing and listing are managed in the dashboard"

	FailedTitle     = "Setup stopped"
	FailedFixPrefix = "Fix the items above, then rerun"
	CancelledTitle  = "Setup cancelled"
	QuitHint        = "ctrl+c to cancel"
)

func PhaseStep(step, total int) string {
	return fmt.Sprintf("[%d/%d]", step, total)
}

func ExpiresIn(remaining string) string {
	return "expires in " + remaining
}

func ApprovalLine(url, code string) string {
	return fmt.Sprintf("Open %s and confirm the code %s", url, code)
}

func SetupFailed(reason string) string {
	return FailedTitle + ": " + reason
}

const (
	ReplaceForbiddenHint         = "ask an organization admin to approve the code, or revoke the old machine in the dashboard first"
	ReplaceOtherOrganizationHint = "approve the code with an account in the organization that owns this machine, or add --organization <slug> to register it into another organization"
	replaceFlag                  = " --replace"
)

func ReplaceHint(profile string) string {
	return Run(ProfileCommand(CommandSetup+replaceFlag, profile)) + " to register this machine again"
}

func RegistrationConflictHint(profile string) string {
	return "choose another --name, or " + ReplaceHint(profile)
}

func ApprovalRetryHint(profile string) string {
	return Run(ProfileCommand(CommandSetup, profile)) + " and approve the new code in the dashboard"
}
