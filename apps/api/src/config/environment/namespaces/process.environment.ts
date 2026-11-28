/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { z } from 'zod';
import { DeploymentEnvironment } from '../../enums/deployment-environment.enum';
import { ProcessRole } from '../../enums/process-role.enum';
import {
	defineEnvironment,
	environmentVariable,
} from '../utils/environment-variable.util';

export const processEnvironment = defineEnvironment(
	{
		title: 'Environment',
		description: 'The deployment selector and the process role',
	},
	{
		SNAPFLOW_ENVIRONMENT: environmentVariable(z.enum(DeploymentEnvironment), {
			description: 'The deployment profile: development or production.',
		}),
		SNAPFLOW_PROCESS_ROLE: environmentVariable(z.enum(ProcessRole).optional(), {
			description:
				'What this process runs (api, worker or all); Kubernetes and moon set it for every API process.',
		}),
	}
);
