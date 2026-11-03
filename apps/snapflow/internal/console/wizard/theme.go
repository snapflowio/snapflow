// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package wizard

import (
	"charm.land/huh/v2"
	"charm.land/lipgloss/v2"
	"github.com/snapflowio/snapflow/internal/cli/style"
)

func formTheme(theme style.Theme) huh.Theme {
	palette := theme.Palette
	return huh.ThemeFunc(func(bool) *huh.Styles {
		styles := huh.ThemeBase(theme.Dark)
		focused := &styles.Focused
		focused.Base = focused.Base.BorderForeground(palette.Primary)
		focused.Card = focused.Base
		focused.Title = lipgloss.NewStyle().Foreground(palette.Foreground).Bold(true)
		focused.Description = lipgloss.NewStyle().Foreground(palette.Muted)
		focused.SelectSelector = lipgloss.NewStyle().Foreground(palette.Primary).SetString(style.SymbolPrompt + " ")
		focused.Option = lipgloss.NewStyle().Foreground(palette.Secondary)
		focused.SelectedOption = lipgloss.NewStyle().Foreground(palette.Accent)
		focused.UnselectedOption = focused.Option
		focused.ErrorIndicator = lipgloss.NewStyle().Foreground(palette.Danger).SetString(" " + style.SymbolFail)
		focused.ErrorMessage = lipgloss.NewStyle().Foreground(palette.Danger)
		focused.TextInput.Cursor = lipgloss.NewStyle().Foreground(palette.Accent)
		focused.TextInput.Prompt = lipgloss.NewStyle().Foreground(palette.Primary)
		focused.TextInput.Text = lipgloss.NewStyle().Foreground(palette.Foreground)
		focused.TextInput.Placeholder = lipgloss.NewStyle().Foreground(palette.Muted)
		styles.Blurred = styles.Focused
		styles.Blurred.Base = styles.Blurred.Base.BorderStyle(lipgloss.HiddenBorder())
		styles.Blurred.Card = styles.Blurred.Base
		styles.Group.Title = focused.Title
		return styles
	})
}
