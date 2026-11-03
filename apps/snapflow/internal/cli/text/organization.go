// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package text

import "fmt"

const (
	OrganizationsTitle       = "Your organizations"
	OrganizationActive       = "active"
	OrganizationChooseTitle  = "Which organization should own this machine?"
	OrganizationChooseHint   = "Earnings and the machine itself belong to the organization you choose."
	OrganizationPickHint     = "rerun with --organization <slug-or-id> to register into another organization"
	UnknownOrganizationHint  = "pass --organization with the slug or ID of an organization you belong to"
	NoActiveOrganizationHint = "select an organization in the dashboard, or pass --organization"
)

func OrganizationName(name, slug string) string {
	return fmt.Sprintf("%s (%s)", name, slug)
}

func RegistersInto(organization string) string {
	return "This machine registers into " + organization
}
