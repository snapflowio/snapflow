// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package daemon

import "log/slog"

const defaultVersion = "v0.0.0-dev"

type options struct {
	logger   *slog.Logger
	version  string
	platform platform
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

func WithReleaseLoader(loader ReleaseLoader) Option {
	return func(configured *options) {
		configured.platform.loadRelease = loader
	}
}

func WithPreflight(preflight Preflight) Option {
	return func(configured *options) {
		configured.platform.preflight = preflight
	}
}

func WithVault(opener VaultOpener) Option {
	return func(configured *options) {
		configured.platform.openVault = opener
	}
}

func WithHostProbe(probe HostProbe) Option {
	return func(configured *options) {
		configured.platform.probeHost = probe
	}
}

func WithRuntime(opener RuntimeOpener) Option {
	return func(configured *options) {
		configured.platform.openRuntime = opener
	}
}

func newOptions(opts []Option) options {
	configured := options{logger: slog.Default(), version: defaultVersion, platform: hostPlatform()}
	for _, apply := range opts {
		apply(&configured)
	}
	return configured
}
