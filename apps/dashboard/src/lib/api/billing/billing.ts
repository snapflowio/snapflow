/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type CreateTopUp,
	createTopUp,
	deletePaymentMethod,
	getTopUp,
	type TopUp,
	TopUpState,
	type UpdateAutoTopUp,
	updateAutoTopUp,
	updateTopUpAmount,
} from '@snapflow/api-client';
import {
	getAutoTopUpOptions,
	getAutoTopUpQueryKey,
	getBillingBudgetOptions,
	getBillingBudgetQueryKey,
	getBillingConfigOptions,
	getBillingOverviewOptions,
	getBillingOverviewQueryKey,
	listPaymentMethodsOptions,
	listPaymentMethodsQueryKey,
	listTopUpsOptions,
	listTopUpsQueryKey,
	updateBillingBudgetMutation,
} from '@snapflow/api-client/svelte-query';
import type { Stripe } from '@stripe/stripe-js';
import { mutationOptions, queryOptions } from '@tanstack/svelte-query';
import {
	idempotencyHeaders,
	ifMatchHeaders,
} from '#lib/api/client/api-client.ts';
import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';

const CONFIRM_ONLY_WHEN_REDIRECT_REQUIRED = 'if_required';
const STRIPE_UNAVAILABLE_MESSAGE = 'Stripe could not be loaded.';
const OVERVIEW_REFRESH_INTERVAL_MILLISECONDS = 15_000;
const RECENT_TOP_UPS_LIMIT = 10;

export const PAYMENT_QUERY_KEYS = [
	getBillingOverviewQueryKey(),
	listTopUpsQueryKey(),
	listPaymentMethodsQueryKey(),
	getAutoTopUpQueryKey(),
];

export function billingOverviewQueryOptions() {
	return queryOptions({
		...getBillingOverviewOptions(),
		refetchInterval: OVERVIEW_REFRESH_INTERVAL_MILLISECONDS,
	});
}

export function recentTopUpsQueryOptions() {
	return listTopUpsOptions({ query: { limit: RECENT_TOP_UPS_LIMIT } });
}

export function billingConfigQueryOptions() {
	return getBillingConfigOptions();
}

export function paymentMethodsQueryOptions() {
	return listPaymentMethodsOptions();
}

export function autoTopUpQueryOptions() {
	return getAutoTopUpOptions();
}

export function billingBudgetQueryOptions() {
	return getBillingBudgetOptions();
}

export function updateBillingBudgetMutationOptions() {
	return mutationOptions({
		...updateBillingBudgetMutation(),
		meta: {
			success: 'Spend limits saved',
			failure: 'Failed to save spend limits',
			invalidates: [getBillingBudgetQueryKey(), getBillingOverviewQueryKey()],
		},
	});
}

type ActionableTopUp = TopUp & { paymentIntentClientSecret: string };

function isActionableTopUp(topUp: TopUp): topUp is ActionableTopUp {
	return (
		topUp.state === TopUpState.RequiresAction &&
		Boolean(topUp.paymentIntentClientSecret)
	);
}

export function pendingTopUpAction(
	topUps: readonly TopUp[] | undefined
): ActionableTopUp | undefined {
	return topUps?.find(isActionableTopUp);
}

interface AutoTopUpChange {
	policy: UpdateAutoTopUp;
	resourceVersion: number;
}

export function createTopUpMutationOptions() {
	return mutationOptions({
		mutationFn: async (body: CreateTopUp) =>
			(await createTopUp({ body, headers: idempotencyHeaders() })).data,
		meta: { failure: 'Failed to start the top-up' },
	});
}

export async function settleTopUp(topUpId: string): Promise<TopUp> {
	return (await getTopUp({ path: { topUpId } })).data;
}

export async function resizeTopUp(
	topUpId: string,
	amountCents: number
): Promise<void> {
	await updateTopUpAmount({ path: { topUpId }, body: { amountCents } });
}

export function deletePaymentMethodMutationOptions() {
	return mutationOptions({
		mutationFn: (paymentMethodId: string) =>
			deletePaymentMethod({ path: { paymentMethodId } }),
		meta: {
			success: 'Card removed',
			failure: 'Failed to remove the card',
			invalidates: PAYMENT_QUERY_KEYS,
		},
	});
}

export function updateAutoTopUpMutationOptions() {
	return mutationOptions({
		mutationFn: ({ policy, resourceVersion }: AutoTopUpChange) =>
			updateAutoTopUp({
				body: policy,
				headers: ifMatchHeaders(resourceVersion),
			}),
		meta: {
			success: 'Automatic top-up saved',
			failure: 'Failed to save the automatic top-up',
			invalidates: PAYMENT_QUERY_KEYS,
		},
	});
}

export function confirmPaymentMutationOptions(
	stripePromise: Promise<Stripe | null>
) {
	return mutationOptions({
		mutationFn: async (clientSecret: string) => {
			const stripe = await stripePromise;
			if (!stripe) throw new SnapflowError(STRIPE_UNAVAILABLE_MESSAGE);
			const result = await stripe.confirmPayment({
				clientSecret,
				redirect: CONFIRM_ONLY_WHEN_REDIRECT_REQUIRED,
			});
			if (result.error) {
				throw new SnapflowError(
					result.error.message ?? STRIPE_UNAVAILABLE_MESSAGE
				);
			}
		},
		meta: {
			success: 'Payment authenticated',
			failure: 'Card authentication failed',
			invalidates: PAYMENT_QUERY_KEYS,
		},
	});
}
