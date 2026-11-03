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
	"github.com/snapflowio/snapflow/internal/console/admin"
)

func UpdateCheck(theme style.Theme, profile string, check admin.UpdateCheck) string {
	installed := theme.Danger.Render(text.ReleaseMissing)
	if check.InstalledVersion != "" {
		installed = theme.Value.Render(check.InstalledVersion)
	}
	lines := []string{
		Header(theme, text.LabelUpdates, profile),
		"",
		Row(theme, text.LabelChannel, theme.Value.Render(string(check.Channel))),
		Row(theme, text.LabelInstalled, installed),
		Row(theme, text.LabelAvailable, theme.Value.Render(check.AvailableVersion)),
		"",
	}
	if !check.UpdateAvailable {
		return Lines(append(lines, Success(theme, text.UpdateCurrent))...)
	}
	return Lines(append(
		lines,
		theme.Warning.Render(style.SymbolWarn+space+text.UpdateAvailable),
		Hint(theme, text.UpdateHint(profile)),
	)...)
}
