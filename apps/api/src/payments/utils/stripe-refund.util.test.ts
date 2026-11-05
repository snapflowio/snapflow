/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { STRIPE_CURRENCY } from '../constants/stripe.constants';
import {
	refundedMicroUsd,
	refundSplit,
	refundSplitFromMetadata,
	refundSplitMetadata,
} from './stripe-refund.util';

const TAXED_TOP_UP = { amountCents: 10_000, taxCents: 800 };
const FULL_REFUND_CENTS = 10_800;
const PARTIAL_REFUND_CENTS = 5_401;
const PLENTY = MicroUsd.fromCents(1_000_000);

describe('refund split', () => {
	it('returns the collected tax and debits the credit portion of a full refund', () => {
		const split = refundSplit(
			FULL_REFUND_CENTS,
			STRIPE_CURRENCY,
			TAXED_TOP_UP,
			PLENTY
		);
		assert.deepEqual(split, {
			creditMicroUsd: MicroUsd.fromCents(10_000),
			taxMicroUsd: MicroUsd.fromCents(800),
			lossMicroUsd: MicroUsd.ZERO,
		});
		assert.deepEqual(
			refundedMicroUsd(split),
			MicroUsd.fromCents(FULL_REFUND_CENTS)
		);
	});

	it('rounds the tax share of a partial refund down', () => {
		const split = refundSplit(
			PARTIAL_REFUND_CENTS,
			STRIPE_CURRENCY,
			TAXED_TOP_UP,
			PLENTY
		);
		assert.deepEqual(split.taxMicroUsd, MicroUsd.fromCents(400));
		assert.deepEqual(split.creditMicroUsd, MicroUsd.fromCents(5_001));
	});

	it('books the credit the customer already spent as a refund loss', () => {
		const split = refundSplit(
			FULL_REFUND_CENTS,
			STRIPE_CURRENCY,
			TAXED_TOP_UP,
			MicroUsd.fromCents(2_500)
		);
		assert.deepEqual(split.creditMicroUsd, MicroUsd.fromCents(2_500));
		assert.deepEqual(split.lossMicroUsd, MicroUsd.fromCents(7_500));
		assert.deepEqual(
			refundedMicroUsd(split),
			MicroUsd.fromCents(FULL_REFUND_CENTS)
		);
	});

	it('restores the posted split from the ledger metadata', () => {
		const split = refundSplit(
			FULL_REFUND_CENTS,
			STRIPE_CURRENCY,
			TAXED_TOP_UP,
			MicroUsd.fromCents(2_500)
		);
		assert.deepEqual(
			refundSplitFromMetadata({ ...refundSplitMetadata(split) }),
			split
		);
		assert.throws(() => refundSplitFromMetadata({}), /creditMicroUsd/);
	});
});
