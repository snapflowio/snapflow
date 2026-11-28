// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package view

import (
	"github.com/snapflowio/snapflow/internal/agent/doctor"
	"github.com/snapflowio/snapflow/internal/ui/cli/text"
	"github.com/snapflowio/snapflow/internal/ui/console/local"
)

func earningTitles() map[string]string {
	return map[string]string{
		local.EarningService:       text.EarningService,
		local.EarningRelease:       text.EarningRelease,
		local.EarningConnection:    text.EarningConnection,
		local.EarningQualification: text.EarningQualification,
		local.EarningListing:       text.EarningListing,
		local.EarningPayouts:       text.EarningPayouts,
	}
}

func earning(result local.StatusResult) []string {
	if len(result.Earning) == 0 {
		return nil
	}
	titles := earningTitles()
	lines := []string{"", text.EarningTitle}
	failed, waiting := 0, 0
	for _, check := range result.Earning {
		title, found := titles[check.Name]
		if !found {
			title = check.Name
		}
		lines = append(lines, checkLine(check.Status, title, check.Detail, earningFix(check)))
		switch check.Status {
		case doctor.CheckFailed:
			failed++
		case doctor.CheckPending:
			waiting++
		case doctor.CheckPassed:
		}
	}
	summary := text.EarningReady
	if !result.EarningReady {
		summary = text.EarningBlocked(failed, waiting)
	}
	return append(lines, "", summary)
}

func earningFix(check local.EarningCheck) string {
	switch {
	case check.FixURL == "":
		return check.Fix
	case check.Fix == "":
		return text.EarningOpenPrefix + check.FixURL
	default:
		return check.Fix + text.EarningFixJoiner + check.FixURL
	}
}
