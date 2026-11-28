// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package daemon

import "context"

type Component interface {
	Run(ctx context.Context) error
}

type registration struct {
	name      string
	component Component
}

type componentSet []registration

func (components *componentSet) register(name string, component Component) {
	*components = append(*components, registration{name: name, component: component})
}
