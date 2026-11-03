/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	loadConnectAndInitialize,
	type StripeConnectInstance,
} from '@stripe/connect-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { fetchPayoutAccountSessionSecret } from '#lib/api/billing/payouts.ts';
import { getPublicConfig } from '#lib/api/public-config.ts';
import {
	dashboardConnectAppearance,
	dashboardConnectFonts,
} from './stripe-appearance.ts';

const stripeInstances = new Map<string, Promise<Stripe | null>>();

function stripeFor(publishableKey: string): Promise<Stripe | null> {
	const existing = stripeInstances.get(publishableKey);
	if (existing) return existing;
	const created = loadStripe(publishableKey);
	stripeInstances.set(publishableKey, created);
	return created;
}

export function getStripePromise(): Promise<Stripe | null> {
	return stripeFor(getPublicConfig().stripePublishableKey);
}

export function createPayoutConnectInstance(): StripeConnectInstance {
	return loadConnectAndInitialize({
		publishableKey: getPublicConfig().stripePublishableKey,
		fetchClientSecret: fetchPayoutAccountSessionSecret,
		appearance: dashboardConnectAppearance(),
		fonts: dashboardConnectFonts(),
	});
}
