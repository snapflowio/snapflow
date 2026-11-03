/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { betterAuthSecretsText, text } from '../utils/environment-schemas.util';
import {
	defineEnvironment,
	environmentVariable,
} from '../utils/environment-variable.util';

export const authenticationEnvironment = defineEnvironment(
	{
		name: 'authentication',
		title: 'Authentication',
		description: 'Session signing secrets and the health check principal',
	},
	{
		BETTER_AUTH_SECRETS: environmentVariable(betterAuthSecretsText(), {
			description:
				'Better Auth signing secrets as <version>:<secret>, newest first.',
			secret: true,
		}),
		HEALTH_CHECK_API_KEY: environmentVariable(text().optional(), {
			description: 'Bearer key of the health check principal.',
			secret: true,
		}),
	}
);
