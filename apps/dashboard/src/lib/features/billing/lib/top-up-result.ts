/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type TopUp, TopUpState } from '@snapflow/api-client';
import type { QueryClient } from '@tanstack/svelte-query';
import { PAYMENT_QUERY_KEYS, settleTopUp } from '#lib/api/billing/billing.ts';
import type { ToastInput } from '#lib/components/ui/toast/toast-model.ts';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';

export const TOP_UP_RETURN_QUERY_KEY = 'topUpId';

const UNPAID_TOP_UP_STATES: readonly TopUpState[] = [
	TopUpState.Failed,
	TopUpState.Expired,
];

function topUpResultToast(topUp: TopUp | null): ToastInput {
	if (topUp?.state === TopUpState.Succeeded) {
		return { message: 'Credit added', variant: 'success' };
	}
	if (topUp && UNPAID_TOP_UP_STATES.includes(topUp.state)) {
		return {
			message: 'Payment not completed',
			description: 'No credit was added. Start a new top-up to try again.',
			variant: 'error',
		};
	}
	return {
		message: 'Payment received',
		description: 'Your credit appears as soon as Stripe confirms the payment.',
		variant: 'success',
	};
}

export async function announceTopUp(
	queryClient: QueryClient,
	topUpId: string
): Promise<void> {
	const settled = await settleTopUp(topUpId).catch(() => null);
	await Promise.all(
		PAYMENT_QUERY_KEYS.map((queryKey) =>
			queryClient.invalidateQueries({ queryKey })
		)
	);
	toast(topUpResultToast(settled));
}
