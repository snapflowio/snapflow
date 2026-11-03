/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ProcessRole } from './enums/process-role.enum';
import { ENVIRONMENT_NAMESPACES } from './environment/registry.environment';
import { readEnvironment } from './environment/utils/read-environment.util';
import { createApplicationConfig } from './factories/application-config.factory';
import { createInfrastructureConfig } from './factories/infrastructure-config.factory';
import { createRuntimeConfig } from './factories/runtime-config.factory';

export function requireProcessRole({
	values,
}: Readonly<{
	values: Readonly<{ SNAPFLOW_PROCESS_ROLE?: ProcessRole }>;
}>): ProcessRole {
	const role = values.SNAPFLOW_PROCESS_ROLE;
	if (!role) {
		throw new Error(
			'SNAPFLOW_PROCESS_ROLE is required: Kubernetes and moon set it for every API process'
		);
	}
	return role;
}

export function loadConfiguration(source: NodeJS.ProcessEnv = process.env) {
	const input = readEnvironment(source, ENVIRONMENT_NAMESPACES);
	const processRole = requireProcessRole(input);
	return {
		processRole,
		...createApplicationConfig(input),
		...createInfrastructureConfig(input),
		...createRuntimeConfig(input),
	};
}

export type Configuration = ReturnType<typeof loadConfiguration>;
