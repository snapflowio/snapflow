// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package view

import (
	"fmt"
	"strings"

	"github.com/snapflowio/snapflow/internal/cli/style"
	"github.com/snapflowio/snapflow/internal/cli/text"
)

const (
	meterWidth      = 10
	meterFilled     = "█"
	meterEmpty      = "░"
	percentMaximum  = 100
	newline         = "\n"
	space           = " "
	brandMark       = "◆"
	headerSeparator = " · "
	warningPercent  = 75
	criticalPercent = 90
)

func Header(theme style.Theme, title, subtitle string) string {
	heading := theme.Brand.Render(brandMark+space+text.Binary) + space + space + theme.Title.Render(title)
	if subtitle != "" {
		heading += theme.Muted.Render(headerSeparator + subtitle)
	}
	return heading
}

func Row(theme style.Theme, label, value string) string {
	return theme.Indent.Render(theme.Label.Render(label) + value)
}

func Success(theme style.Theme, message string) string {
	return theme.Success.Render(style.SymbolPass) + space + theme.Title.Render(message)
}

func Failure(theme style.Theme, message, hint string) string {
	rendered := theme.Danger.Render(style.SymbolFail + space + message)
	if hint != "" {
		rendered += newline + Hint(theme, hint)
	}
	return rendered
}

func Prompt(theme style.Theme, question string) string {
	return theme.Warning.Render(style.SymbolArrow) + space + theme.Title.Render(question) + space +
		theme.Muted.Render(text.PromptChoices) + space
}

func Hint(theme style.Theme, hint string) string {
	return theme.Indent.Render(theme.Code.Render(style.SymbolArrow) + space + theme.Secondary.Render(hint))
}

func Command(theme style.Theme, command, explanation string, width int) string {
	return theme.Indent.Render(theme.Code.Width(width).Render(command) + theme.Muted.Render(explanation))
}

func Lines(lines ...string) string {
	return strings.Join(lines, newline)
}

func meter(theme style.Theme, percent float32) string {
	clamped := min(max(percent, 0), percentMaximum)
	filled := int(clamped * meterWidth / percentMaximum)
	tone := theme.Success
	switch {
	case clamped >= criticalPercent:
		tone = theme.Danger
	case clamped >= warningPercent:
		tone = theme.Warning
	}
	return tone.Render(strings.Repeat(meterFilled, filled)) +
		theme.Muted.Render(strings.Repeat(meterEmpty, meterWidth-filled)) +
		space + fmt.Sprintf("%3.0f%%", clamped)
}

func Indent(rendered string) string {
	prefix := strings.Repeat(space, style.IndentWidth)
	return prefix + strings.ReplaceAll(rendered, newline, newline+prefix)
}
