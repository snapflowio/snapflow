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
	"github.com/snapflowio/snapflow/internal/control"
)

func OrganizationName(organization control.Organization) string {
	return text.OrganizationName(organization.Name, organization.Slug)
}

func Organizations(theme style.Theme, choice control.OrganizationChoice) string {
	lines := []string{theme.Indent.Render(theme.Heading.Render(text.OrganizationsTitle))}
	for _, organization := range choice.Organizations {
		line := theme.Muted.Render(style.SymbolBullet) + space + theme.Text.Render(OrganizationName(organization))
		if organization.ID == choice.Active.ID {
			line += theme.Success.Render(text.DetailSeparator + text.OrganizationActive)
		}
		lines = append(lines, Indent(theme.Indent.Render(line)))
	}
	lines = append(
		lines,
		theme.Indent.Render(theme.Title.Render(text.RegistersInto(OrganizationName(choice.Active)))),
		Hint(theme, text.OrganizationPickHint),
	)
	return Lines(lines...)
}
