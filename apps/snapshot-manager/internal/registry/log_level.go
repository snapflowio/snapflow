// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package registry

import "log/slog"

const (
	registryLogDebug = "debug"
	registryLogInfo  = "info"
	registryLogWarn  = "warn"
	registryLogError = "error"
)

func registryLogLevel(level slog.Level) string {
	switch {
	case level <= slog.LevelDebug:
		return registryLogDebug
	case level <= slog.LevelInfo:
		return registryLogInfo
	case level <= slog.LevelWarn:
		return registryLogWarn
	default:
		return registryLogError
	}
}
