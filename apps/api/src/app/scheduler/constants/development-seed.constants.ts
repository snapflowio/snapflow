/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { SettingsChanges } from '../../../settings/platform/types/settings.types';

// The devcontainer's plain-HTTP registry; `moon run sandbox-image:dev-publish`
// pushes the Snapflow sandbox image there.
export const DEVELOPMENT_REGISTRY = {
	name: 'Development registry',
	url: 'http://registry:5000',
	username: '',
	password: '',
} as const;

export const DEVELOPMENT_SEED_SETTINGS = {
	machineGuestRegistryUrl: DEVELOPMENT_REGISTRY.url,
	machineDesktopEnabled: true,
	defaultSnapshot: 'registry:5000/snapflowio/sandbox:dev',
	sandboxDefaultLimitedNetworkEgress: true,
} as const satisfies SettingsChanges;

export const DEVELOPMENT_EDGE = {
	id: 'ab457b3e-8a13-4b2c-b837-f9ccc29c1a95',
	name: 'local-edge',
	publicHost: 'snapflow.localhost',
	tunnelAddress: { host: '127.0.0.1', port: 4_443 },
	loopbackAddress: '127.0.0.1',
	portRange: { from: 23_000, to: 23_031 },
} as const;

export const DEVELOPMENT_ADMINISTRATOR = {
	name: 'Snapflow Admin',
	email: 'test@mail.com',
} as const;
