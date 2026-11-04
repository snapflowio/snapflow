/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { text } from '../utils/environment-schemas.util';
import {
	defineEnvironment,
	environmentVariable,
} from '../utils/environment-variable.util';

export const socialSignInEnvironment = defineEnvironment(
	{
		title: 'Social sign-in',
		description:
			'OAuth applications for Google and GitHub sign-in; a provider is offered only when both of its variables are set',
	},
	{
		GOOGLE_CLIENT_ID: environmentVariable(text().optional(), {
			description: 'Client ID of the Google OAuth application.',
		}),
		GOOGLE_CLIENT_SECRET: environmentVariable(text().optional(), {
			description: 'Client secret of the Google OAuth application.',
			secret: true,
		}),
		GITHUB_CLIENT_ID: environmentVariable(text().optional(), {
			description: 'Client ID of the GitHub OAuth application.',
		}),
		GITHUB_CLIENT_SECRET: environmentVariable(text().optional(), {
			description: 'Client secret of the GitHub OAuth application.',
			secret: true,
		}),
	}
);
