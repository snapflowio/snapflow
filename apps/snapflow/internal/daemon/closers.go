// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package daemon

import "log/slog"

type closer struct {
	name  string
	close func() error
}

type closers struct {
	stack []closer
}

func (stack *closers) push(name string, close func() error) {
	stack.stack = append(stack.stack, closer{name: name, close: close})
}

func (stack *closers) closeAll(logger *slog.Logger) {
	for index := len(stack.stack) - 1; index >= 0; index-- {
		resource := stack.stack[index]
		if err := resource.close(); err != nil {
			logger.Warn("Failed to release Snapflow resource", "resource", resource.name, "error", err)
		}
	}
	stack.stack = nil
}
