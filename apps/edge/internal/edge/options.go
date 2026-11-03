// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package edge

import (
	"log/slog"

	"github.com/snapflowio/edge/internal/control"
)

const defaultVersion = "development"

type options struct {
	logger      *slog.Logger
	version     string
	tunnels     Tunnels
	hostSampler control.HostSampler
}

type Option func(*options)

func WithLogger(logger *slog.Logger) Option {
	return func(configured *options) {
		configured.logger = logger
	}
}

func WithVersion(version string) Option {
	return func(configured *options) {
		configured.version = version
	}
}

func WithTunnels(tunnels Tunnels) Option {
	return func(configured *options) {
		configured.tunnels = tunnels
	}
}

func WithHostSampler(sampler control.HostSampler) Option {
	return func(configured *options) {
		configured.hostSampler = sampler
	}
}

func newOptions(opts []Option) options {
	configured := options{logger: slog.Default(), version: defaultVersion}
	for _, apply := range opts {
		apply(&configured)
	}
	return configured
}
