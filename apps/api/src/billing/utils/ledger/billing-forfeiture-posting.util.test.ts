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
import { MicroUsd } from '../../../common/values/micro-usd.value';
import {
	BillingLedgerAccountCode,
	BillingLedgerSide,
	BillingLedgerSourceType,
} from '../../constants/billing.constants';
import {
	earningsForfeiturePosting,
	type ForfeitableLine,
} from './billing-forfeiture-posting.util';

const line: ForfeitableLine = {
	lineId: '0f1e2d3c-4b5a-4968-8776-655443322110',
	customerOrganizationId: '11111111-1111-4111-8111-111111111111',
	hostOrganizationId: '22222222-2222-4222-8222-222222222222',
	grossMicroUsd: MicroUsd.of(1_250n),
	hostMicroUsd: MicroUsd.of(1_000n),
	markupMicroUsd: MicroUsd.of(250n),
};
const REVIEW_ID = '33333333-3333-4333-8333-333333333333';
const EFFECTIVE_AT = new Date('2026-10-14T00:00:00.000Z');

function total(
	posting: ReturnType<typeof earningsForfeiturePosting>,
	side: string
): bigint {
	return posting.entries
		.filter((entry) => entry.side === side)
		.reduce((sum, entry) => sum + BigInt(entry.amount), 0n);
}

describe('earningsForfeiturePosting', () => {
	it('reverses the host and markup shares back to the customer', () => {
		const posting = earningsForfeiturePosting(line, REVIEW_ID, EFFECTIVE_AT);
		assert.equal(
			posting.sourceType,
			BillingLedgerSourceType.EARNINGS_FORFEITURE
		);
		assert.equal(posting.sourceReference, line.lineId);
		assert.equal(
			total(posting, BillingLedgerSide.DEBIT),
			total(posting, BillingLedgerSide.CREDIT)
		);
		assert.deepEqual(
			posting.entries.map((entry) => [
				entry.account.accountCode,
				entry.side,
				entry.amount,
			]),
			[
				[
					BillingLedgerAccountCode.HOST_EARNINGS_PENDING,
					BillingLedgerSide.DEBIT,
					'1000',
				],
				[
					BillingLedgerAccountCode.PLATFORM_MARKUP_REVENUE,
					BillingLedgerSide.DEBIT,
					'250',
				],
				[
					BillingLedgerAccountCode.CUSTOMER_CREDIT,
					BillingLedgerSide.CREDIT,
					'1250',
				],
			]
		);
	});

	it('omits a zero markup entry', () => {
		const posting = earningsForfeiturePosting(
			{
				...line,
				grossMicroUsd: MicroUsd.of(1_000n),
				markupMicroUsd: MicroUsd.ZERO,
			},
			REVIEW_ID,
			EFFECTIVE_AT
		);
		assert.equal(posting.entries.length, 2);
	});

	it('refuses a line whose shares do not add up', () => {
		assert.throws(() =>
			earningsForfeiturePosting(
				{ ...line, markupMicroUsd: MicroUsd.of(1n) },
				REVIEW_ID,
				EFFECTIVE_AT
			)
		);
	});
});
