/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { create } from '@bufbuild/protobuf';
import { type Registry, RegistrySchema } from '@snapflow/machine-proto';
import type { DockerRegistry } from '../entities/docker-registry.entity';
import { registryEndpoint } from './docker-registry-url.util';

export type RegistryCredentials = Pick<
	DockerRegistry,
	'url' | 'username' | 'password' | 'project'
>;

export function registryMessage(credentials: RegistryCredentials): Registry {
	return create(RegistrySchema, {
		url: registryEndpoint(credentials.url),
		username: credentials.username || undefined,
		password: credentials.password || undefined,
		project: credentials.project || undefined,
	});
}
