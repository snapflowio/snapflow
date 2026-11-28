// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package admit

import "github.com/snapflowio/edge/internal/routes"

type Scope struct {
	Owner       string
	Route       string
	Binding     string
	Interactive bool
}

func RouteScope(route routes.Base) Scope {
	return Scope{
		Owner:       route.OwnerID.String(),
		Route:       route.BackendID.String(),
		Binding:     route.BindingID.String(),
		Interactive: route.Interactive,
	}
}
