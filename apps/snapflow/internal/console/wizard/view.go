// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package wizard

import (
	"time"

	tea "charm.land/bubbletea/v2"
	"github.com/snapflowio/snapflow/internal/cli/style"
	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/config"
	"github.com/snapflowio/snapflow/internal/console/admin"
	"github.com/snapflowio/snapflow/internal/console/view"
)

const (
	space            = " "
	nextStepWidth    = 32
	countdownRounder = time.Second
)

func (current model) View() tea.View {
	theme := current.cfg.theme
	lines := []string{view.Header(theme, text.SetupTitle, current.cfg.profile), ""}
	for _, phase := range current.phases {
		lines = append(lines, current.phaseLine(phase))
		if phase.phase == admin.SetupPhasePreflight && phase.state != phasePending {
			lines = append(lines, current.checkLines()...)
		}
		if phase.phase == admin.SetupPhaseAuthorization && phase.state == phaseActive {
			lines = append(lines, current.authorizationLines()...)
		}
	}
	lines = append(lines, "", current.footer())
	return tea.NewView(view.Lines(lines...) + "\n")
}

func (current model) phaseLine(phase phaseView) string {
	theme := current.cfg.theme
	title := phaseTitles()[phase.phase]
	switch {
	case phase.state == phaseDone:
		line := theme.Success.Render(style.SymbolPass) + space + theme.Text.Render(title)
		if note := noteTexts()[phase.note]; note != "" {
			line += theme.Muted.Render(text.DetailSeparator + note)
		}
		return theme.Indent.Render(line)
	case phase.state == phaseActive && current.stage == stageFailed:
		return theme.Indent.Render(theme.Danger.Render(style.SymbolFail + space + title))
	case phase.state == phaseActive:
		return theme.Indent.Render(current.spinner.View() + space + theme.Title.Render(title))
	default:
		return theme.Indent.Render(theme.Muted.Render(style.SymbolPending + space + title))
	}
}

func (current model) checkLines() []string {
	lines := make([]string, 0, len(current.checks))
	for _, check := range current.checks {
		lines = append(lines, view.Indent(view.Check(current.cfg.theme, check)))
	}
	return lines
}

func (current model) authorizationLines() []string {
	switch {
	case current.stage == stageOrganization:
		return []string{"", view.Indent(current.choice.form.View())}
	case current.approval.presented:
		return []string{"", current.approvalPanel()}
	default:
		return nil
	}
}

func (current model) approvalPanel() string {
	theme := current.cfg.theme
	status := text.ApprovalWaiting + text.DetailSeparator + current.expiry()
	if current.approval.browser != "" {
		status += text.DetailSeparator + current.approval.browser
	}
	panel, err := view.Approval(theme, view.ApprovalConfig{Code: current.approval.code, ShowQR: true, Status: status})
	if err != nil {
		return view.Failure(theme, err.Error(), "")
	}
	return view.Indent(panel)
}

func (current model) expiry() string {
	lifetime := time.Duration(current.approval.code.ExpiresIn) * time.Second
	remaining := lifetime - current.cfg.now().Sub(current.approval.shownAt)
	if remaining <= 0 {
		return text.ApprovalExpired
	}
	return text.ExpiresIn(remaining.Round(countdownRounder).String())
}

func (current model) footer() string {
	theme := current.cfg.theme
	switch current.stage {
	case stageDone:
		return summary(theme, current.cfg.profile, current.result)
	case stageFailed:
		return view.Lines(
			view.Failure(theme, text.SetupFailed(current.err.Error()), ""),
			view.Hint(theme, hintFor(current.err, current.cfg.profile)),
		)
	case stageCancelled:
		return view.Failure(theme, text.CancelledTitle, "")
	default:
		return theme.Indent.Render(theme.Muted.Render(text.QuitHint))
	}
}

func summary(theme style.Theme, profile string, result admin.SetupResult) string {
	if result.Profile == config.Development {
		return view.Lines(
			view.Success(theme, text.DevelopmentDoneTitle),
			"",
			view.Row(theme, text.DoneMachine, theme.Value.Render(result.MachineID)),
			view.Row(theme, text.DoneDashboard, theme.Link.Render(result.DashboardURL)),
			"",
			theme.Indent.Render(theme.Heading.Render(text.DoneNextSteps)),
			view.Command(theme, text.DevelopmentServeTask, text.NextStepServe, nextStepWidth),
		)
	}
	return view.Lines(
		view.Success(theme, text.DoneTitle),
		"",
		view.Row(theme, text.DoneMachine, theme.Value.Render(result.MachineID)),
		view.Row(theme, text.DoneProfile, theme.Value.Render(profile)),
		view.Row(theme, text.DoneDashboard, theme.Link.Render(result.DashboardURL)),
		view.Row(theme, text.LabelLocation, view.Location(theme, result.Location)),
		view.Row(theme, text.LabelPayouts, view.Payouts(theme, result.Payouts)),
		"",
		theme.Indent.Render(theme.Heading.Render(text.DoneNextSteps)),
		view.Command(theme, text.ProfileCommand(text.CommandStatusWatch, profile), text.NextStepWatch, nextStepWidth),
		view.Command(theme, text.ProfileCommand(text.CommandLogsFollow, profile), text.NextStepLogs, nextStepWidth),
		"",
		theme.Indent.Render(theme.Muted.Render(text.MarketplaceManagedInDashboard)),
	)
}
