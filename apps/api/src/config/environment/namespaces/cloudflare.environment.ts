/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { PRODUCTION_ONLY } from '../../constants/deployment-environment.constants';
import { text } from '../utils/environment-schemas.util';
import {
	defineEnvironment,
	environmentVariable,
} from '../utils/environment-variable.util';

export const cloudflareEnvironment = defineEnvironment(
	{
		name: 'cloudflare',
		title: 'Cloudflare',
		description:
			'Custom domains through the Cloudflare zone of the platform domain',
	},
	{
		SNAPFLOW_CLOUDFLARE_API_TOKEN: environmentVariable(text().optional(), {
			description:
				"Cloudflare API token with Zone:Read, DNS:Edit and SSL and Certificates:Edit on the platform domain's zone; the zone and its custom hostname fallback origin (the custom domains' CNAME target) are looked up with it.",
			secret: true,
			requiredIn: PRODUCTION_ONLY,
		}),
		SNAPFLOW_CLOUDFLARE_WEBHOOK_SECRET: environmentVariable(text().optional(), {
			description: 'Shared secret of Cloudflare custom hostname webhooks.',
			secret: true,
			requiredIn: PRODUCTION_ONLY,
		}),
	}
);
