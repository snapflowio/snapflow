// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package registry

import (
	"log/slog"
	"testing"
)

func TestRegistryLogLevel(t *testing.T) {
	t.Parallel()

	for level, want := range map[slog.Level]string{
		slog.LevelDebug:     registryLogDebug,
		slog.LevelInfo:      registryLogInfo,
		slog.LevelWarn:      registryLogWarn,
		slog.LevelError:     registryLogError,
		slog.LevelDebug + 1: registryLogInfo,
	} {
		if got := registryLogLevel(level); got != want {
			t.Fatalf("registryLogLevel(%s) = %q, want %q", level, got, want)
		}
	}
}
