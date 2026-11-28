// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package console

const defaultVersion = "v0.0.0-dev"

type options struct {
	version string
}

type Option func(*options)

func WithVersion(version string) Option {
	return func(configured *options) {
		configured.version = version
	}
}

func newOptions(opts []Option) options {
	configured := options{version: defaultVersion}
	for _, apply := range opts {
		apply(&configured)
	}
	return configured
}
