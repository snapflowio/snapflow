/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash } from 'node:crypto';
import { MILLISECONDS_PER_SECOND } from '../../../common/constants/time.constants';
import { canonicalJson } from '../../../common/utils/canonical-json.util';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import {
	STRIPE_CURRENCY,
	type StripeIdempotencyPrefix,
} from '../constants/stripe.constants';

export function stripeAmountMicroUsd(
	cents: number,
	currency: string
): MicroUsd {
	if (currency !== STRIPE_CURRENCY) {
		throw new Error(`Stripe amount is in ${currency}, not ${STRIPE_CURRENCY}`);
	}
	return MicroUsd.fromCents(cents);
}

export function stripeTimestamp(seconds: number): Date {
	return new Date(seconds * MILLISECONDS_PER_SECOND);
}

export function idempotencyKey(
	prefix: StripeIdempotencyPrefix,
	reference: string
): string {
	return `${prefix}:${reference}`;
}

export function requestFingerprint(params: object): string {
	return createHash('sha256').update(canonicalJson(params)).digest('hex');
}

export function expandableId(
	value: string | { id: string } | null | undefined
): string | null {
	if (value === null || value === undefined) return null;
	return typeof value === 'string' ? value : value.id;
}

// Stripe search query matching objects whose metadata holds the value.
export function stripeMetadataQuery(key: string, value: string): string {
	return `metadata['${key}']:'${value}'`;
}
