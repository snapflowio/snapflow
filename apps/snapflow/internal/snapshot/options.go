// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package snapshot

import (
	"log/slog"
	"time"

	"github.com/snapflowio/tunnel-go/reconnect"
)

type options struct {
	logger      *slog.Logger
	clock       func() time.Time
	pullBackoff reconnect.Backoff
}

type Option func(*options)

func WithLogger(logger *slog.Logger) Option {
	return func(configured *options) {
		configured.logger = logger
	}
}

func WithClock(clock func() time.Time) Option {
	return func(configured *options) {
		configured.clock = clock
	}
}

func WithPullBackoff(backoff reconnect.Backoff) Option {
	return func(configured *options) {
		configured.pullBackoff = backoff
	}
}

func newOptions(opts []Option) options {
	configured := options{logger: slog.Default(), clock: time.Now, pullBackoff: defaultPullBackoff()}
	for _, apply := range opts {
		apply(&configured)
	}
	return configured
}
