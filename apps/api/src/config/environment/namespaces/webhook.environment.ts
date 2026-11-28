/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { DEVELOPMENT_ONLY } from '../../constants/deployment-environment.constants';
import {
	booleanText,
	cidrListText,
	positiveIntegerText,
} from '../utils/environment-schemas.util';
import {
	defineEnvironment,
	environmentVariable,
} from '../utils/environment-variable.util';

export const webhookEnvironment = defineEnvironment(
	{
		title: 'Webhooks',
		description: 'Delivery of organization webhooks to customer endpoints',
		note: 'In development, set SNAPFLOW_WEBHOOK_ALLOW_HTTP=true and SNAPFLOW_WEBHOOK_ALLOWED_CIDRS=127.0.0.1/32 to deliver to a local receiver.',
	},
	{
		SNAPFLOW_WEBHOOK_ALLOW_HTTP: environmentVariable(
			booleanText().prefault('false'),
			{
				description:
					'Accept plain http:// webhook endpoint URLs; production only accepts https://.',
				allowedIn: DEVELOPMENT_ONLY,
			}
		),
		SNAPFLOW_WEBHOOK_ALLOWED_CIDRS: environmentVariable(
			cidrListText().prefault(''),
			{
				description:
					'Private or loopback destinations webhook deliveries may reach despite the SSRF guard.',
				allowedIn: DEVELOPMENT_ONLY,
			}
		),
		SNAPFLOW_WEBHOOK_TIMEOUT_MS: environmentVariable(
			positiveIntegerText().prefault('15000'),
			{
				description:
					'Time a webhook endpoint has to answer one delivery attempt.',
			}
		),
		SNAPFLOW_WEBHOOK_DISABLE_AFTER_DAYS: environmentVariable(
			positiveIntegerText().prefault('5'),
			{
				description:
					'Days of uninterrupted delivery failures after which an endpoint is disabled.',
			}
		),
		SNAPFLOW_WEBHOOK_RETENTION_DAYS: environmentVariable(
			positiveIntegerText().prefault('30'),
			{
				description:
					'Days webhook messages, deliveries and attempt logs are kept.',
			}
		),
	}
);
