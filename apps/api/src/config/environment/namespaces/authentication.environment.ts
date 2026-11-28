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
		title: 'Authentication',
		description:
			'Session signing secrets, the health check principal and sign-in bot protection',
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
		TURNSTILE_SITE_KEY: environmentVariable(text(), {
			description:
				'Cloudflare Turnstile sitekey the dashboard renders before it sends an email sign-in code. Development can use the always-pass test sitekey 1x00000000000000000000AA.',
		}),
		TURNSTILE_SECRET_KEY: environmentVariable(text(), {
			description:
				'Cloudflare Turnstile secret key the API verifies sign-in tokens with. Development can use the always-pass test secret 1x0000000000000000000000000000000AA.',
			secret: true,
		}),
	}
);
