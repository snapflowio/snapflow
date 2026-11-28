// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package text

import "fmt"

const (
	EnrollTwoKeys     = "give the enrollment key once, as the argument or with --token"
	EnrollTwoKeysHint = "copy the install command from the dashboard's Add machine page"
)

const (
	EnrollTitle = "Machine enrollment"

	PhaseInspection = "Inspecting this machine"
	PhasePreflight  = "Checking machine requirements"
	PhaseRelease    = "Installing the verified Snapflow release"
	PhaseEnrollment = "Enrolling this machine"
	PhaseService    = "Starting the Snapflow service"

	NoteReleaseVerified = "already installed and verified"
	NoteAlreadyEnrolled = "already enrolled; no enrollment key needed"

	EnrolledTitle            = "This machine is enrolled and the Snapflow service is running"
	DevelopmentEnrolledTitle = "This machine is enrolled for development"
	FollowProgress           = "follow its progress on the dashboard page above: connected, benchmarking, awaiting approval, listed"
	CheckEarning             = "run `sudo snapflow status` any time to see what still stands between this machine and earnings"
	NextStepsTitle           = "Next steps"
	FailedFixPrefix          = "Fix the items above, then rerun"
	EnrollStopped            = "enrollment stopped"
)

const (
	AddMachineHint         = "create an enrollment key on the dashboard's Host mode \"Add machine\" page and rerun the install command it shows"
	KeyInvalidHint         = "the key may have expired or been revoked; " + AddMachineHint
	KeyUsedHint            = "a single-use key enrolls one machine; " + AddMachineHint
	HostKeyInUseHint       = "this machine's host key belongs to another enrolled machine; erase its state with `sudo snapflow uninstall --purge`, then enroll again"
	EnrollmentConflictHint = "a machine with this name is already enrolled in the organization: remove it in the dashboard, or enroll with another --name"
	ProofRejectedHint      = "check that the system clock is correct, then rerun enroll"
	ReenrollHint           = "remove the old machine in the dashboard, then " + AddMachineHint
)

func SetUpPayouts(url string) string {
	return "add a payout wallet, if your organization has none, so earnings can be paid out: " + url
}

func PhaseStep(step, total int) string {
	return fmt.Sprintf("[%d/%d]", step, total)
}
