// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package style

import (
	"image/color"

	"charm.land/lipgloss/v2"
)

const (
	darkForeground = "#f0ede6"
	darkSecondary  = "#aba9a4"
	darkMuted      = "#72706d"
	darkPrimary    = "#8b5cf6"
	darkAccent     = "#a78bfa"
	darkInfo       = "#aeb9ff"
	darkSuccess    = "#8be7aa"
	darkWarning    = "#f6ad45"
	darkDanger     = "#ff635c"

	lightForeground = "#0a0a0a"
	lightSecondary  = "#545454"
	lightMuted      = "#6e6e6e"
	lightPrimary    = "#6d28d9"
	lightAccent     = "#7c3aed"
	lightInfo       = "#2b4fff"
	lightSuccess    = "#15803d"
	lightWarning    = "#b45309"
	lightDanger     = "#c81e1e"
)

type Palette struct {
	Foreground color.Color
	Secondary  color.Color
	Muted      color.Color
	Primary    color.Color
	Accent     color.Color
	Info       color.Color
	Success    color.Color
	Warning    color.Color
	Danger     color.Color
}

func NewPalette(dark bool) Palette {
	choose := lipgloss.LightDark(dark)
	pick := func(lightColor, darkColor string) color.Color {
		return choose(lipgloss.Color(lightColor), lipgloss.Color(darkColor))
	}
	return Palette{
		Foreground: pick(lightForeground, darkForeground),
		Secondary:  pick(lightSecondary, darkSecondary),
		Muted:      pick(lightMuted, darkMuted),
		Primary:    pick(lightPrimary, darkPrimary),
		Accent:     pick(lightAccent, darkAccent),
		Info:       pick(lightInfo, darkInfo),
		Success:    pick(lightSuccess, darkSuccess),
		Warning:    pick(lightWarning, darkWarning),
		Danger:     pick(lightDanger, darkDanger),
	}
}
