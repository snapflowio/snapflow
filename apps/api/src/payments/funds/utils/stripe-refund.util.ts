/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MicroUsd } from '../../../common/values/micro-usd.value';
import type { TopUp } from '../entities/top-up.entity';
import { stripeAmountMicroUsd } from './stripe-amount.util';

export interface RefundSplit {
	creditMicroUsd: MicroUsd;
	taxMicroUsd: MicroUsd;
	lossMicroUsd: MicroUsd;
}

const REFUND_SPLIT_KEYS = [
	'creditMicroUsd',
	'taxMicroUsd',
	'lossMicroUsd',
] as const satisfies readonly (keyof RefundSplit)[];

// The refunded tax share is rounded down so partial refunds never return more
// tax than the top-up collected.
export function refundSplit(
	refundedCents: number,
	currency: string,
	topUp: Pick<TopUp, 'amountCents' | 'taxCents'>,
	spendableMicroUsd: MicroUsd
): RefundSplit {
	const grossCents = topUp.amountCents + topUp.taxCents;
	const taxCents = Math.floor((refundedCents * topUp.taxCents) / grossCents);
	const creditMicroUsd = stripeAmountMicroUsd(
		refundedCents - taxCents,
		currency
	);
	const debitedMicroUsd = spendableMicroUsd.min(creditMicroUsd).nonnegative();
	return {
		creditMicroUsd: debitedMicroUsd,
		taxMicroUsd: stripeAmountMicroUsd(taxCents, currency),
		lossMicroUsd: creditMicroUsd.subtract(debitedMicroUsd),
	};
}

export function refundedMicroUsd(split: RefundSplit): MicroUsd {
	return MicroUsd.sum(REFUND_SPLIT_KEYS.map((key) => split[key]));
}

export function refundSplitMetadata(
	split: RefundSplit
): Record<(typeof REFUND_SPLIT_KEYS)[number], string> {
	return {
		creditMicroUsd: split.creditMicroUsd.toString(),
		taxMicroUsd: split.taxMicroUsd.toString(),
		lossMicroUsd: split.lossMicroUsd.toString(),
	};
}

function metadataAmount(
	metadata: Readonly<Record<string, unknown>>,
	key: (typeof REFUND_SPLIT_KEYS)[number]
): MicroUsd {
	const value = metadata[key];
	if (typeof value !== 'string') {
		throw new Error(`Refund posting metadata has no ${key}`);
	}
	return MicroUsd.parse(value);
}

export function refundSplitFromMetadata(
	metadata: Readonly<Record<string, unknown>>
): RefundSplit {
	return {
		creditMicroUsd: metadataAmount(metadata, 'creditMicroUsd'),
		taxMicroUsd: metadataAmount(metadata, 'taxMicroUsd'),
		lossMicroUsd: metadataAmount(metadata, 'lossMicroUsd'),
	};
}
