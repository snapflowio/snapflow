/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { requireProcessRole } from '../configuration.config';
import { PROCESS_ROLE_TRAITS } from '../constants/process-role.constants';
import { processEnvironment } from '../environment/namespaces/process.environment';
import { readEnvironment } from '../environment/utils/read-environment.util';

function readCurrentProcess() {
	const input = readEnvironment(process.env, [processEnvironment]);
	const role = requireProcessRole(input);
	return {
		role,
		traits: PROCESS_ROLE_TRAITS[role],
		profile: input.profile,
		values: input.values,
	};
}

let current: ReturnType<typeof readCurrentProcess> | undefined;

export function currentProcess(): ReturnType<typeof readCurrentProcess> {
	current ??= readCurrentProcess();
	return current;
}
