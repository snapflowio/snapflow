// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package registry

import "log/slog"

const defaultVersion = "v0.0.0-dev"

type options struct {
	logger   *slog.Logger
	logLevel slog.Level
	version  string
	writes   writeGate
}

type Option func(*options)

func WithLogger(logger *slog.Logger) Option {
	return func(configured *options) {
		configured.logger = logger
	}
}

func WithLogLevel(level slog.Level) Option {
	return func(configured *options) {
		configured.logLevel = level
	}
}

func WithVersion(version string) Option {
	return func(configured *options) {
		configured.version = version
	}
}

func WithWriteGate(gate WriteGate) Option {
	return func(configured *options) {
		configured.writes = writeGate{gate: gate}
	}
}

func newOptions(opts []Option) options {
	configured := options{logger: slog.Default(), logLevel: slog.LevelInfo, version: defaultVersion, writes: defaultWriteGate()}
	for _, apply := range opts {
		apply(&configured)
	}
	return configured
}
