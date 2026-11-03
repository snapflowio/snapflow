// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package sandbox

import "log/slog"

type options struct {
	logger *slog.Logger
}

type Option func(*options)

func WithLogger(logger *slog.Logger) Option {
	return func(configured *options) {
		configured.logger = logger
	}
}

func newOptions(opts []Option) options {
	configured := options{logger: slog.Default()}
	for _, apply := range opts {
		apply(&configured)
	}
	return configured
}
