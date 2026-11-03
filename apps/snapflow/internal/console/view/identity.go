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

func Identity(theme style.Theme, profile string, identity admin.RegistrationStatus) string {
	header := Header(theme, text.LabelMachine, profile)
	if !identity.Registered {
		return Lines(header, "", Failure(theme, text.NotRegisteredTitle, text.Run(text.ProfileCommand(text.CommandSetup, profile))))
	}
	return Lines(
		header, "",
		Row(theme, text.LabelMachine, theme.Value.Render(identity.MachineID)),
		Row(theme, text.LabelOrganization, theme.Value.Render(identity.OwnerID)),
		Row(theme, text.LabelAPI, theme.Link.Render(identity.ControlPlane)),
	)
}
