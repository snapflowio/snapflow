/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { originText, text } from '../utils/environment-schemas.util';
import {
	defineEnvironment,
	environmentVariable,
} from '../utils/environment-variable.util';

export const analyticsEnvironment = defineEnvironment(
	{
		title: 'Product Analytics',
		description:
			'PostHog product analytics that the dashboard loads only after a visitor consents',
	},
	{
		POSTHOG_PROJECT_KEY: environmentVariable(text().optional(), {
			description:
				'Public PostHog project API key; set it together with POSTHOG_HOST, or leave both unset to disable analytics and the consent banner.',
		}),
		POSTHOG_HOST: environmentVariable(originText().optional(), {
			description:
				'PostHog ingestion origin, such as https://eu.i.posthog.com; set it together with POSTHOG_PROJECT_KEY.',
		}),
	}
);
