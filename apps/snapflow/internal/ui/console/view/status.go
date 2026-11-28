// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package view

import (
	"slices"
	"strings"

	"github.com/snapflowio/snapflow/internal/foundation/state"
	"github.com/snapflowio/snapflow/internal/install"
	"github.com/snapflowio/snapflow/internal/ui/cli/text"
	"github.com/snapflowio/snapflow/internal/ui/console/local"
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

func Status(result local.StatusResult) string {
	lines := []string{Header(text.StatusTitle, result.Profile), ""}
	registration := result.Registration
	if !registration.Registered && registration.Error == "" {
		return Lines(append(lines, Failure(text.NotEnrolledTitle, text.AddMachineHint), Row(text.LabelDashboard, dashboard(result)))...)
	}
	if registration.NeedsEnrollment {
		lines = append(lines, Failure(registration.Error, text.ReenrollHint), "")
	}
	lines = append(lines, identityRows(result)...)
	lines = append(lines, controlPlaneRows(result.ControlPlane)...)
	lines = append(lines, localRows(result)...)
	lines = append(lines, Row(text.LabelDashboard, dashboard(result)))
	lines = append(lines, list(text.RecentErrorsTitle, result.RecentErrors)...)
	lines = append(lines, list(text.ProblemsTitle, unexplained(result))...)
	lines = append(lines, earning(result)...)
	return Lines(lines...)
}

func unexplained(result local.StatusResult) []string {
	remaining := make([]string, 0, len(result.Errors))
	for _, problem := range result.Errors {
		explained := slices.ContainsFunc(result.Earning, func(check local.EarningCheck) bool {
			return strings.Contains(check.Detail, problem)
		})
		if !explained {
			remaining = append(remaining, problem)
		}
	}
	return remaining
}

func dashboard(result local.StatusResult) string {
	if result.MachineURL != "" {
		return result.MachineURL
	}
	return result.DashboardURL
}

func identityRows(result local.StatusResult) []string {
	registration := result.Registration
	machine := registration.MachineID
	if result.ControlPlane != nil {
		machine = result.ControlPlane.Name + text.DetailSeparator + machine
	}
	return []string{
		Row(text.LabelMachine, machine),
		Row(text.LabelOrganization, registration.OrganizationID),
		Row(text.LabelHostKey, registration.HostAddress),
		Row(text.LabelAPI, registration.ControlPlane),
	}
}

func controlPlaneRows(machine *apiclient.MachineIdentityStatus) []string {
	if machine == nil {
		return []string{Row(text.LabelState, text.StateUnreachable)}
	}
	return []string{
		Row(text.LabelState, machineState(machine)),
		Row(text.LabelScheduling, scheduling(machine)),
		Row(text.LabelSandboxes, text.SandboxCount(int(optionalNumber(machine.CurrentStartedSandboxes)))),
		Row(text.LabelCPU, text.Usage(optionalNumber(machine.CurrentCpuUsagePercentage),
			optionalNumber(machine.CurrentAllocatedCpu), machine.Cpu, text.UnitVCPU)),
		Row(text.LabelMemory, text.Usage(optionalNumber(machine.CurrentMemoryUsagePercentage),
			float32(optionalCount(machine.CurrentAllocatedMemoryMiB)), float32(machine.AllocatableMemoryMiB), text.UnitMiB)),
		Row(text.LabelDisk, text.Usage(optionalNumber(machine.CurrentDiskUsagePercentage),
			optionalNumber(machine.CurrentAllocatedDiskGiB), machine.Disk, text.UnitGiB)),
		Row(text.LabelHealth, health(machine.ServiceHealth)),
	}
}

func localRows(result local.StatusResult) []string {
	rows := []string{Row(text.LabelDaemon, daemon(result.Daemon))}
	if result.Service != nil {
		rows = append(rows, Row(text.LabelService, service(*result.Service)))
	}
	return append(
		rows,
		Row(text.LabelRelease, release(result.Release)),
		Row(text.LabelUpdates, updates(result.Update)),
		Row(text.LabelPaymentHolds, paymentHolds(result.PaymentHolds)),
	)
}

func updates(status install.UpdateStatus) string {
	if status.Phase == "" {
		return text.UpdatesUnknown
	}
	return text.UpdateSummary(string(status.Phase), status.Channel, status.MaintenanceWindow)
}

func machineState(machine *apiclient.MachineIdentityStatus) string {
	description, found := stateDescriptions()[machine.State]
	if !found {
		description = text.StateUnknown
	}
	if reason := optionalText(machine.ReadinessReason); reason != "" && machine.State != apiclient.MachineStateReady {
		description += text.DetailSeparator + reason
	}
	return description
}

func scheduling(machine *apiclient.MachineIdentityStatus) string {
	switch {
	case machine.Draining:
		return text.SchedulingDraining
	case machine.Unschedulable:
		return text.SchedulingQualifying
	default:
		return text.SchedulingAccepting
	}
}

func health(reported *[]apiclient.MachineServiceHealth) string {
	if reported == nil || len(*reported) == 0 {
		return text.HealthNoReports
	}
	parts := make([]string, 0, len(*reported))
	for _, service := range *reported {
		if service.Healthy {
			parts = append(parts, service.ServiceName+" "+statusPassed)
			continue
		}
		parts = append(parts, service.ServiceName+" "+statusFailed+text.DetailSeparator+optionalText(service.ErrorReason))
	}
	return strings.Join(parts, text.ListSeparator)
}

func daemon(status local.DaemonStatus) string {
	if status.Reachable {
		return text.DaemonVersion(status.Version)
	}
	return text.DaemonUnreachable + text.DetailSeparator + status.Error
}

func service(status local.ServiceStatus) string {
	switch {
	case !status.Active:
		return text.ServiceInactive
	case !status.Enabled:
		return text.ServiceDisabled
	default:
		return text.ServiceActiveEnabled
	}
}

func release(status local.ReleaseStatus) string {
	if status.Active == nil {
		return text.ReleaseMissing
	}
	if status.Verified {
		return status.Active.Version + text.DetailSeparator + text.ReleaseVerified
	}
	return status.Active.Version + text.DetailSeparator + text.ReleaseUnverified
}

func paymentHolds(holds []state.SandboxPaymentHold) string {
	if len(holds) == 0 {
		return text.PaymentHoldsNone
	}
	sandboxIDs := make([]string, 0, len(holds))
	for _, hold := range holds {
		sandboxIDs = append(sandboxIDs, hold.SandboxID)
	}
	return text.PaymentHolds(sandboxIDs)
}

func optionalCount(value *int) int {
	if value == nil {
		return 0
	}
	return *value
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
