// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package view

import (
	"github.com/snapflowio/snapflow/internal/cli/style"
	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/console/doctor"
)

const checkTitleWidth = 26

func checkTitles() map[string]string {
	return map[string]string{
		doctor.CheckKVM:                 text.CheckKVM,
		doctor.CheckNetworkPolicy:       text.CheckNetworkPolicy,
		doctor.CheckIPv4Forwarding:      text.CheckIPv4Forwarding,
		doctor.CheckHostTools:           text.CheckHostTools,
		doctor.CheckVMLimits:            text.CheckVMLimits,
		doctor.CheckSystemd:             text.CheckSystemd,
		doctor.CheckStorage:             text.CheckStorage,
		doctor.CheckReflink:             text.CheckReflink,
		doctor.CheckRelease:             text.CheckRelease,
		doctor.CheckReadinessContract:   text.CheckReadinessContract,
		doctor.CheckRegistration:        text.CheckRegistration,
		doctor.CheckProfileControlPlane: text.CheckProfileControlPlane,
		doctor.CheckAPI:                 text.CheckAPI,
		doctor.CheckGuestRegistry:       text.CheckGuestRegistry,
		doctor.CheckEdge:                text.CheckEdge,
		doctor.CheckBenchmark:           text.CheckBenchmark,
	}
}

func CheckTitle(name string) string {
	if title, found := checkTitles()[name]; found {
		return title
	}
	return name
}

func Check(theme style.Theme, check doctor.DiagnosticCheck) string {
	line := theme.Indent.Render(checkSymbol(theme, check) + space +
		theme.Text.Width(checkTitleWidth).Render(CheckTitle(check.Name)) + theme.Muted.Render(check.Detail))
	if check.Status == doctor.CheckPassed || check.Remediation == "" {
		return line
	}
	return line + newline + Indent(Hint(theme, check.Remediation))
}

func DiagnosisSummary(theme style.Theme, report doctor.Diagnosis) string {
	failed := 0
	for _, check := range report.Checks {
		if check.Status == doctor.CheckFailed {
			failed++
		}
	}
	if failed == 0 {
		return Success(theme, text.DoctorReady)
	}
	return Failure(theme, text.DoctorFailed(failed), "")
}

func checkSymbol(theme style.Theme, check doctor.DiagnosticCheck) string {
	switch check.Status {
	case doctor.CheckPassed:
		return theme.Success.Render(style.SymbolPass)
	case doctor.CheckFailed:
		return theme.Danger.Render(style.SymbolFail)
	default:
		return theme.Warning.Render(style.SymbolWarn)
	}
}
