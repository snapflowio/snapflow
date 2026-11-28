// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package view

import (
	"github.com/snapflowio/snapflow/internal/foundation/config"
	"github.com/snapflowio/snapflow/internal/ui/cli/text"
	"github.com/snapflowio/snapflow/internal/ui/console/local"
)

func phaseTitles() map[local.EnrollPhase]string {
	return map[local.EnrollPhase]string{
		local.EnrollPhaseInspection: text.PhaseInspection,
		local.EnrollPhasePreflight:  text.PhasePreflight,
		local.EnrollPhaseRelease:    text.PhaseRelease,
		local.EnrollPhaseEnrollment: text.PhaseEnrollment,
		local.EnrollPhaseService:    text.PhaseService,
	}
}

func noteTexts() map[local.EnrollNote]string {
	return map[local.EnrollNote]string{
		local.EnrollNoteReleaseVerified: text.NoteReleaseVerified,
		local.EnrollNoteAlreadyEnrolled: text.NoteAlreadyEnrolled,
	}
}

func EnrollPhaseStarted(progress local.EnrollProgress) string {
	return text.PhaseStep(progress.Step, progress.Total) + promptSuffix + phaseTitles()[progress.Phase]
}

func EnrollPhaseFinished(progress local.EnrollProgress) string {
	if note := noteTexts()[progress.Note]; note != "" {
		return indent + statusPassed + promptSuffix + note
	}
	return ""
}

func Enrolled(result local.EnrollResult) string {
	title := text.EnrolledTitle
	if result.Profile == config.Development {
		title = text.DevelopmentEnrolledTitle
	}
	dashboard := result.MachineURL
	if dashboard == "" {
		dashboard = result.DashboardURL
	}
	lines := []string{
		Success(title),
		Row(text.LabelMachine, result.MachineID),
		Row(text.LabelOrganization, result.OrganizationID),
		Row(text.LabelHostKey, result.HostAddress),
		Row(text.LabelDashboard, dashboard),
	}
	nextSteps := []string{text.FollowProgress}
	if result.PayoutsURL != "" {
		nextSteps = append(nextSteps, text.SetUpPayouts(result.PayoutsURL))
	}
	nextSteps = append(nextSteps, text.CheckEarning)
	return Lines(append(lines, list(text.NextStepsTitle, nextSteps)...)...)
}
