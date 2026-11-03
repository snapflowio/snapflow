// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package style

import (
	"charm.land/lipgloss/v2"
)

const (
	SymbolPass    = "✓"
	SymbolFail    = "✗"
	SymbolWarn    = "!"
	SymbolPending = "○"
	SymbolBullet  = "•"
	SymbolArrow   = "→"
	SymbolPrompt  = "›"
)

const (
	panelPaddingHorizontal = 2
	panelPaddingVertical   = 0
	labelWidth             = 14
)

const IndentWidth = 2

type Theme struct {
	Palette Palette
	Dark    bool

	Brand     lipgloss.Style
	Title     lipgloss.Style
	Heading   lipgloss.Style
	Text      lipgloss.Style
	Secondary lipgloss.Style
	Muted     lipgloss.Style
	Label     lipgloss.Style
	Value     lipgloss.Style
	Code      lipgloss.Style
	Link      lipgloss.Style
	Success   lipgloss.Style
	Warning   lipgloss.Style
	Danger    lipgloss.Style
	Panel     lipgloss.Style
	Indent    lipgloss.Style
}

func New(dark bool) Theme {
	palette := NewPalette(dark)
	base := lipgloss.NewStyle()
	return Theme{
		Palette:   palette,
		Dark:      dark,
		Brand:     base.Foreground(palette.Primary).Bold(true),
		Title:     base.Foreground(palette.Foreground).Bold(true),
		Heading:   base.Foreground(palette.Accent).Bold(true),
		Text:      base.Foreground(palette.Foreground),
		Secondary: base.Foreground(palette.Secondary),
		Muted:     base.Foreground(palette.Muted),
		Label:     base.Foreground(palette.Secondary).Width(labelWidth),
		Value:     base.Foreground(palette.Foreground),
		Code:      base.Foreground(palette.Accent),
		Link:      base.Foreground(palette.Info).Underline(true),
		Success:   base.Foreground(palette.Success),
		Warning:   base.Foreground(palette.Warning),
		Danger:    base.Foreground(palette.Danger).Bold(true),
		Panel: base.Border(lipgloss.RoundedBorder()).BorderForeground(palette.Primary).
			Padding(panelPaddingVertical, panelPaddingHorizontal),
		Indent: base.PaddingLeft(IndentWidth),
	}
}
