// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package wizard

import (
	tea "charm.land/bubbletea/v2"
	"charm.land/huh/v2"
	"github.com/snapflowio/snapflow/internal/cli/style"
	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/console/view"
	"github.com/snapflowio/snapflow/internal/control"
)

type (
	organizationSubmittedMsg struct{}
	organizationCancelledMsg struct{}
)

type organizationForm struct {
	form     *huh.Form
	selected control.Organization
}

func newOrganizationForm(theme style.Theme, choice control.OrganizationChoice) *organizationForm {
	selection := &organizationForm{selected: choice.Active}
	options := make([]huh.Option[control.Organization], 0, len(choice.Organizations))
	for _, organization := range choice.Organizations {
		label := view.OrganizationName(organization)
		if organization.ID == choice.Active.ID {
			label += text.DetailSeparator + text.OrganizationActive
		}
		options = append(options, huh.NewOption(label, organization))
	}
	selection.form = huh.NewForm(
		huh.NewGroup(huh.NewSelect[control.Organization]().
			Title(text.OrganizationChooseTitle).Description(text.OrganizationChooseHint).
			Options(options...).Value(&selection.selected)),
	).WithTheme(formTheme(theme)).WithShowHelp(true)
	selection.form.SubmitCmd = func() tea.Msg { return organizationSubmittedMsg{} }
	selection.form.CancelCmd = func() tea.Msg { return organizationCancelledMsg{} }
	return selection
}

func (current model) askOrganization(choice control.OrganizationChoice) (tea.Model, tea.Cmd) {
	current.choice, current.stage = newOrganizationForm(current.cfg.theme, choice), stageOrganization
	return current, current.choice.form.Init()
}

func (current model) updateOrganization(message tea.Msg) (tea.Model, tea.Cmd) {
	switch message.(type) {
	case organizationCancelledMsg:
		return current.finish(stageCancelled)
	case organizationSubmittedMsg:
		selected := current.choice.selected
		current.stage, current.choice = stageRunning, nil
		return current, deliver(current.cfg.organizations, selected)
	}
	var command tea.Cmd
	current.choice.form, command = forward(current.choice.form, message)
	return current, command
}
