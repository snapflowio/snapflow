/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Sandbox } from '@snapflow/api-client';
import {
	BILLING_FIX_LABELS,
	BillingFix,
	billingFixHref,
	PAYMENT_HOLD_COPY,
	PAYMENT_HOLD_PENDING_LABEL,
} from '#lib/features/billing/lib/billing-overview.ts';

type PaymentHoldView = Pick<
	Sandbox,
	'state' | 'pausedForPayment' | 'pauseReason'
>;

export interface PaymentHold {
	cause: string;
	fixLabel: string;
	fixHref: string;
}

export function sandboxPaymentHold(
	sandbox: PaymentHoldView
): PaymentHold | null {
	if (!sandbox.pausedForPayment) return null;
	const copy = sandbox.pauseReason
		? PAYMENT_HOLD_COPY[sandbox.pauseReason]
		: null;
	const fix = copy?.fix ?? BillingFix.Signer;
	return {
		cause: copy?.paused ?? PAYMENT_HOLD_PENDING_LABEL,
		fixLabel: BILLING_FIX_LABELS[fix],
		fixHref: billingFixHref(fix),
	};
}
