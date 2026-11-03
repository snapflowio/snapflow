// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package wizard

import (
	"time"

	"charm.land/bubbles/v2/spinner"
	tea "charm.land/bubbletea/v2"
	"charm.land/huh/v2"
	"github.com/snapflowio/snapflow/internal/cli/style"
	"github.com/snapflowio/snapflow/internal/console/admin"
	"github.com/snapflowio/snapflow/internal/console/doctor"
	"github.com/snapflowio/snapflow/internal/control"
)

const keyInterrupt = "ctrl+c"

type stage int

const (
	stageRunning stage = iota
	stageOrganization
	stageDone
	stageFailed
	stageCancelled
)

type phaseState int

const (
	phasePending phaseState = iota
	phaseActive
	phaseDone
)

type phaseView struct {
	phase admin.SetupPhase
	state phaseState
	note  admin.SetupNote
}

type approval struct {
	code      control.DeviceAuthorization
	shownAt   time.Time
	browser   string
	presented bool
}

type browserMsg struct {
	err error
}

type model struct {
	cfg      modelConfig
	stage    stage
	phases   []phaseView
	checks   []doctor.DiagnosticCheck
	approval approval
	choice   *organizationForm
	spinner  spinner.Model
	result   admin.SetupResult
	err      error
}

type modelConfig struct {
	theme         style.Theme
	profile       string
	phases        []admin.SetupPhase
	organizations chan<- control.Organization
	openBrowser   func(string) tea.Cmd
	now           func() time.Time
}

func newModel(cfg modelConfig) model {
	phases := []phaseView{}
	for _, phase := range cfg.phases {
		phases = append(phases, phaseView{phase: phase})
	}
	return model{
		cfg:     cfg,
		phases:  phases,
		spinner: spinner.New(spinner.WithSpinner(spinner.MiniDot), spinner.WithStyle(cfg.theme.Brand)),
	}
}

func (current model) Init() tea.Cmd {
	return current.spinner.Tick
}

func (current model) Update(message tea.Msg) (tea.Model, tea.Cmd) {
	switch message := message.(type) {
	case tea.KeyPressMsg:
		if message.String() == keyInterrupt {
			return current.finish(stageCancelled)
		}
	case spinner.TickMsg:
		var command tea.Cmd
		current.spinner, command = current.spinner.Update(message)
		return current, command
	case phaseStartedMsg:
		current.setPhase(admin.SetupProgress(message), phaseActive)
		return current, nil
	case phaseFinishedMsg:
		current.setPhase(admin.SetupProgress(message), phaseDone)
		return current, nil
	case checkMsg:
		current.checks = append(current.checks, doctor.DiagnosticCheck(message))
		return current, nil
	case approvalMsg:
		return current.showApproval(control.DeviceAuthorization(message))
	case browserMsg:
		current.approval.browser = browserNote(message.err)
		return current, nil
	case organizationRequestMsg:
		return current.askOrganization(control.OrganizationChoice(message))
	case setupDoneMsg:
		current.result, current.err = message.result, message.err
		if message.err != nil {
			return current.finish(stageFailed)
		}
		return current.finish(stageDone)
	}
	if current.stage == stageOrganization {
		return current.updateOrganization(message)
	}
	return current, nil
}

func (current *model) setPhase(progress admin.SetupProgress, state phaseState) {
	for index := range current.phases {
		if current.phases[index].phase == progress.Phase {
			current.phases[index].state = state
			current.phases[index].note = progress.Note
		}
	}
}

func (current model) showApproval(code control.DeviceAuthorization) (tea.Model, tea.Cmd) {
	current.approval = approval{code: code, shownAt: current.cfg.now(), presented: true}
	return current, current.cfg.openBrowser(code.VerificationURIComplete)
}

func deliver[T any](destination chan<- T, value T) tea.Cmd {
	return func() tea.Msg {
		destination <- value
		return nil
	}
}

func forward(form *huh.Form, message tea.Msg) (*huh.Form, tea.Cmd) {
	updated, command := form.Update(message)
	if next, isForm := updated.(*huh.Form); isForm {
		return next, command
	}
	return form, command
}

func (current model) finish(final stage) (tea.Model, tea.Cmd) {
	current.stage = final
	return current, tea.Quit
}
