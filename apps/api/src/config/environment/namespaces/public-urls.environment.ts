/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import {
	DEVELOPMENT_ONLY,
	PRODUCTION_ONLY,
} from '../../constants/deployment-environment.constants';
import { originText, portText, text } from '../utils/environment-schemas.util';
import {
	defineEnvironment,
	environmentVariable,
} from '../utils/environment-variable.util';

export const publicUrlsEnvironment = defineEnvironment(
	{
		title: 'Public URLs & Domain',
		description:
			'The public origins of the API, website and dashboard, and the sandbox domain',
	},
	{
		API_URL: environmentVariable(originText().optional(), {
			description:
				'Public origin of the API; hosted deployments require HTTPS.',
			requiredIn: PRODUCTION_ONLY,
		}),
		WEBSITE_URL: environmentVariable(originText().optional(), {
			description: 'Public origin of the marketing website.',
			requiredIn: PRODUCTION_ONLY,
		}),
		ADMIN_URL: environmentVariable(originText().optional(), {
			description: 'Public origin of the dashboard (served under /dashboard).',
			requiredIn: PRODUCTION_ONLY,
		}),
		SNAPFLOW_PLATFORM_DOMAIN: environmentVariable(text().optional(), {
			description:
				'Domain under which sandboxes are exposed; hosted deployments refuse a localhost domain or one sharing a site with API_URL, ADMIN_URL or WEBSITE_URL.',
			requiredIn: PRODUCTION_ONLY,
		}),
		SNAPFLOW_EDGE_HTTPS_PORT: environmentVariable(portText().optional(), {
			description:
				'HTTPS port of the local edge in sandbox origins; hosted edges serve the default 443.',
			allowedIn: DEVELOPMENT_ONLY,
		}),
		SNAPFLOW_EDGE_GUEST_ORIGIN: environmentVariable(originText().optional(), {
			description:
				'Origin at which sandbox guests reach the local edge for speedtests; hosted guests reach each edge at https://<its public host>.',
			allowedIn: DEVELOPMENT_ONLY,
		}),
	}
);
