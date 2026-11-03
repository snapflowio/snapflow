// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package view

import (
	"strings"

	"charm.land/lipgloss/v2"
	"github.com/snapflowio/snapflow/internal/cli/style"
	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/console/admin"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

func stateDescriptions() map[apiclient.MachineState]string {
	return map[apiclient.MachineState]string{
		apiclient.MachineStateReady:          text.StateReady,
		apiclient.MachineStateInitializing:   text.StateInitializing,
		apiclient.MachineStateDraining:       text.StateDraining,
		apiclient.MachineStateFailed:         text.StateFailed,
		apiclient.MachineStateDisabled:       text.StateDisabled,
		apiclient.MachineStateDecommissioned: text.StateDecommissioned,
		apiclient.MachineStateUnresponsive:   text.StateUnresponsive,
	}
}

func Status(theme style.Theme, result admin.StatusResult) string {
	machine := result.ControlPlane
	title := text.LabelMachine
	if machine != nil {
		title = machine.Name
	}
	lines := []string{Header(theme, title, result.Profile), ""}
	if !result.Registration.Registered && result.Registration.Error == "" {
		return Lines(append(lines, Failure(theme, text.NotRegisteredTitle,
			text.Run(text.ProfileCommand(text.CommandSetup, result.Profile))))...)
	}
	if result.Registration.NeedsReplace {
		lines = append(lines, Failure(theme, result.Registration.Error,
			text.ReplaceHint(result.Profile)), "")
	}
	if machine != nil {
		lines = append(lines, controlPlaneRows(theme, machine)...)
	}
	lines = append(lines, localRows(theme, result)...)
	lines = append(lines, Row(theme, text.LabelEarnings, theme.Secondary.Render(text.EarningsDashboard+headerSeparator)+
		theme.Link.Render(result.DashboardURL)))
	if machine != nil {
		lines = append(lines, Row(theme, text.LabelPayouts, Payouts(theme, machine.Payouts)))
	}
	lines = append(lines, marketplaceRows(theme, machine)...)
	lines = append(lines, list(theme, text.RecentErrorsTitle, result.RecentErrors, theme.Warning, style.SymbolBullet)...)
	lines = append(lines, list(theme, text.ProblemsTitle, result.Errors, theme.Danger, style.SymbolFail)...)
	return Lines(lines...)
}

func Payouts(theme style.Theme, readiness apiclient.PayoutReadiness) string {
	switch readiness {
	case apiclient.PayoutReadinessReady:
		return theme.Success.Render(text.PayoutsReady)
	case apiclient.PayoutReadinessPending:
		return theme.Secondary.Render(text.PayoutsPending)
	case apiclient.PayoutReadinessActionRequired:
		return theme.Danger.Render(text.PayoutsActionRequired)
	case apiclient.PayoutReadinessNotSetUp:
		return theme.Warning.Render(text.PayoutsNotSetUp)
	default:
		return theme.Muted.Render(text.PayoutsUnknown)
	}
}

func Location(theme style.Theme, location *apiclient.Location) string {
	if location == nil {
		return theme.Muted.Render(text.LocationPending)
	}
	if location.City == nil || *location.City == "" {
		return theme.Value.Render(location.Country)
	}
	return theme.Value.Render(*location.City + text.LocationSeparator + location.Country)
}

func controlPlaneRows(theme style.Theme, machine *apiclient.MachineIdentityStatus) []string {
	return []string{
		Row(theme, text.LabelState, machineState(theme, machine)),
		Row(theme, text.LabelLocation, Location(theme, machine.Location)),
		Row(theme, text.LabelScheduling, scheduling(theme, machine)),
		Row(theme, text.LabelSandboxes, theme.Value.Render(text.SandboxCount(int(optionalNumber(machine.CurrentStartedSandboxes))))),
		Row(theme, text.LabelCPU, meter(theme, optionalNumber(machine.CurrentCpuUsagePercentage))+
			theme.Muted.Render(text.DetailSeparator+text.Allocated(optionalNumber(machine.CurrentAllocatedCpu), machine.Cpu, text.UnitVCPU))),
		Row(theme, text.LabelMemory, meter(theme, optionalNumber(machine.CurrentMemoryUsagePercentage))+
			theme.Muted.Render(text.DetailSeparator+text.Allocated(optionalNumber(machine.CurrentAllocatedMemoryGiB), machine.Memory, text.UnitGiB))),
		Row(theme, text.LabelDisk, meter(theme, optionalNumber(machine.CurrentDiskUsagePercentage))+
			theme.Muted.Render(text.DetailSeparator+text.Allocated(optionalNumber(machine.CurrentAllocatedDiskGiB), machine.Disk, text.UnitGiB))),
		Row(theme, text.LabelHealth, health(theme, machine.ServiceHealth)),
	}
}

func localRows(theme style.Theme, result admin.StatusResult) []string {
	rows := []string{Row(theme, text.LabelDaemon, daemon(theme, result.Daemon))}
	if result.Service != nil {
		rows = append(rows, Row(theme, text.LabelService, service(theme, *result.Service)))
	}
	return append(
		rows,
		Row(theme, text.LabelRelease, release(theme, result.Release)),
		Row(theme, text.LabelUpdates, theme.Value.Render(text.UpdateSummary(
			string(result.Update.Phase), result.Update.Channel, result.Update.MaintenanceWindow,
		))),
	)
}

func machineState(theme style.Theme, machine *apiclient.MachineIdentityStatus) string {
	description, found := stateDescriptions()[machine.State]
	if !found {
		description = text.StateUnknown
	}
	if reason := optionalText(machine.ReadinessReason); reason != "" && machine.State != apiclient.MachineStateReady {
		description += text.DetailSeparator + reason
	}
	switch machine.State {
	case apiclient.MachineStateReady:
		return theme.Success.Render(style.SymbolPass + space + description)
	case apiclient.MachineStateInitializing, apiclient.MachineStateDraining:
		return theme.Warning.Render(style.SymbolPending + space + description)
	default:
		return theme.Danger.Render(style.SymbolFail + space + description)
	}
}

func scheduling(theme style.Theme, machine *apiclient.MachineIdentityStatus) string {
	switch {
	case machine.Draining:
		return theme.Warning.Render(text.SchedulingDraining)
	case machine.Unschedulable:
		return theme.Warning.Render(text.SchedulingQualifying)
	default:
		return theme.Success.Render(text.SchedulingAccepting)
	}
}

func health(theme style.Theme, reported *[]apiclient.MachineServiceHealth) string {
	if reported == nil || len(*reported) == 0 {
		return theme.Muted.Render(text.HealthNoReports)
	}
	services := *reported
	parts := make([]string, 0, len(services))
	for _, service := range services {
		if service.Healthy {
			parts = append(parts, theme.Success.Render(style.SymbolPass)+space+theme.Value.Render(service.ServiceName))
			continue
		}
		parts = append(parts, theme.Danger.Render(style.SymbolFail)+space+theme.Value.Render(service.ServiceName)+
			theme.Muted.Render(text.DetailSeparator+optionalText(service.ErrorReason)))
	}
	return strings.Join(parts, text.ListSeparator)
}

func daemon(theme style.Theme, status admin.DaemonStatus) string {
	if status.Reachable {
		return theme.Success.Render(style.SymbolPass) + space + theme.Value.Render(text.DaemonVersion(status.Version))
	}
	return theme.Danger.Render(style.SymbolFail+space+text.DaemonUnreachable) + theme.Muted.Render(text.DetailSeparator+status.Error)
}

func service(theme style.Theme, status admin.ServiceStatus) string {
	switch {
	case !status.Active:
		return theme.Danger.Render(style.SymbolFail + space + text.ServiceInactive)
	case !status.Enabled:
		return theme.Warning.Render(style.SymbolWarn + space + text.ServiceDisabled)
	default:
		return theme.Success.Render(style.SymbolPass) + space + theme.Value.Render(text.ServiceActiveEnabled)
	}
}

func release(theme style.Theme, status admin.ReleaseStatus) string {
	if status.Active == nil {
		return theme.Danger.Render(style.SymbolFail + space + text.ReleaseMissing)
	}
	version := theme.Value.Render(status.Active.Version)
	if status.Verified {
		return version + theme.Success.Render(text.DetailSeparator+style.SymbolPass+space+text.ReleaseVerified)
	}
	return version + theme.Danger.Render(text.DetailSeparator+style.SymbolFail+space+text.ReleaseUnverified)
}

func list(theme style.Theme, title string, entries []string, tone lipgloss.Style, symbol string) []string {
	if len(entries) == 0 {
		return nil
	}
	lines := []string{"", theme.Indent.Render(theme.Heading.Render(title))}
	for _, entry := range entries {
		lines = append(lines, theme.Indent.Render(tone.Render(symbol)+space+theme.Secondary.Render(entry)))
	}
	return lines
}

func optionalNumber(value *float32) float32 {
	if value == nil {
		return 0
	}
	return *value
}

func optionalText(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
