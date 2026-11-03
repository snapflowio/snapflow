/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { FactoryProvider } from '@nestjs/common';
import Stripe from 'stripe';
import { DeploymentEnvironment } from '../../../config/enums/deployment-environment.enum';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import type { DeploymentProfile } from '../../../config/types/deployment-profile.types';
import {
	STRIPE_API_VERSION,
	STRIPE_APP_NAME,
	STRIPE_CLIENT,
	STRIPE_MAX_NETWORK_RETRIES,
} from '../constants/stripe.constants';

export function createStripeClient(secretKey: string): Stripe {
	return new Stripe(secretKey, {
		apiVersion: STRIPE_API_VERSION,
		maxNetworkRetries: STRIPE_MAX_NETWORK_RETRIES,
		appInfo: { name: STRIPE_APP_NAME },
	});
}

export function expectedStripeLivemode(deployment: DeploymentProfile): boolean {
	return deployment.name === DeploymentEnvironment.PRODUCTION;
}

async function assertLivemode(
	client: Stripe,
	deployment: DeploymentProfile
): Promise<void> {
	const { livemode } = await client.balance.retrieve();
	if (livemode !== expectedStripeLivemode(deployment)) {
		throw new Error(
			`STRIPE_SECRET_KEY is a ${livemode ? 'live' : 'test'} key, which ${deployment.name} refuses`
		);
	}
}

export const stripeClientProvider: FactoryProvider<Stripe> = {
	provide: STRIPE_CLIENT,
	inject: [TypedConfigService],
	useFactory: async (config: TypedConfigService): Promise<Stripe> => {
		const client = createStripeClient(config.get('stripe.secretKey'));
		await assertLivemode(client, config.get('deployment'));
		return client;
	},
};
