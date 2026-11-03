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

export const stripeEnvironment = defineEnvironment(
	{
		name: 'stripe',
		title: 'Stripe',
		description: 'Stripe Connect top-ups, host payouts and webhooks',
	},
	{
		STRIPE_SECRET_KEY: environmentVariable(text(), {
			description:
				'Stripe secret API key; the API refuses a live key outside production and a test key in production.',
			secret: true,
		}),
		STRIPE_PLATFORM_WEBHOOK_SECRET: environmentVariable(text(), {
			description:
				'Signing secret of the platform event destination (POST /api/stripe/webhooks/platform).',
			secret: true,
		}),
		STRIPE_CONNECT_WEBHOOK_SECRET: environmentVariable(text(), {
			description:
				'Signing secret of the connected-accounts event destination (POST /api/stripe/webhooks/connect).',
			secret: true,
		}),
		STRIPE_PUBLISHABLE_KEY: environmentVariable(text(), {
			description:
				'Stripe publishable key the dashboard loads Stripe.js and Connect.js with.',
		}),
	}
);
