// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package wizard

import (
	"context"

	tea "charm.land/bubbletea/v2"
	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/console/admin"
	"github.com/snapflowio/snapflow/internal/console/doctor"
	"github.com/snapflowio/snapflow/internal/control"
)

type (
	phaseStartedMsg        admin.SetupProgress
	phaseFinishedMsg       admin.SetupProgress
	checkMsg               doctor.DiagnosticCheck
	approvalMsg            control.DeviceAuthorization
	organizationRequestMsg control.OrganizationChoice
	setupDoneMsg           struct {
		result admin.SetupResult
		err    error
	}
)

type bridge struct {
	send          func(tea.Msg)
	organizations <-chan control.Organization
}

func (bridge bridge) PhaseStarted(progress admin.SetupProgress) {
	bridge.send(phaseStartedMsg(progress))
}

func (bridge bridge) PhaseFinished(progress admin.SetupProgress) {
	bridge.send(phaseFinishedMsg(progress))
}

func (bridge bridge) CheckCompleted(check doctor.DiagnosticCheck) {
	bridge.send(checkMsg(check))
}

func (bridge bridge) AuthorizationStarted(code control.DeviceAuthorization) {
	bridge.send(approvalMsg(code))
}

func (bridge bridge) ChooseOrganization(
	ctx context.Context,
	choice control.OrganizationChoice,
) (control.Organization, error) {
	bridge.send(organizationRequestMsg(choice))
	return receive(ctx, bridge.organizations)
}

func receive[T any](ctx context.Context, values <-chan T) (T, error) {
	select {
	case value := <-values:
		return value, nil
	case <-ctx.Done():
		var empty T
		return empty, ctx.Err()
	}
}

func phaseTitles() map[admin.SetupPhase]string {
	return map[admin.SetupPhase]string{
		admin.SetupPhaseInspection:    text.PhaseInspection,
		admin.SetupPhasePreflight:     text.PhasePreflight,
		admin.SetupPhaseRelease:       text.PhaseRelease,
		admin.SetupPhaseAuthorization: text.PhaseAuthorization,
		admin.SetupPhaseService:       text.PhaseService,
		admin.SetupPhaseReadiness:     text.PhaseReadiness,
	}
}

func noteTexts() map[admin.SetupNote]string {
	return map[admin.SetupNote]string{
		admin.SetupNoteReleaseVerified: text.NoteReleaseVerified,
		admin.SetupNoteAlreadyApproved: text.NoteAlreadyApproved,
	}
}
