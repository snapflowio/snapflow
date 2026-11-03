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
import { PayoutsBlockedReason } from '../constants/payments.constants';
import {
	PaymentAccountRequirementsStatus,
	PaymentAccountTransfersStatus,
} from '../enums/payment-account-status.enum';
import {
	isoWeekday,
	isoWeekId,
	nextPayoutDate,
	payoutAccountEligible,
	payoutAmount,
} from './payout.util';

const ELIGIBLE = {
	transfersStatus: PaymentAccountTransfersStatus.ACTIVE,
	requirementsStatus: PaymentAccountRequirementsStatus.EVENTUALLY_DUE,
	payoutsBlockedReason: null,
};

describe('payout eligibility', () => {
	it('pays whole cents of the available balance at or above the minimum', () => {
		assert.deepEqual(payoutAmount(MicroUsd.of(50_009_999n), 5_000), {
			amountCents: 5_000,
			amountMicroUsd: MicroUsd.of(50_000_000n),
		});
		assert.equal(payoutAmount(MicroUsd.of(49_999_999n), 5_000), null);
		assert.equal(payoutAmount(MicroUsd.ZERO, 0), null);
		assert.equal(payoutAmount(MicroUsd.of(-10_000n), 0), null);
	});

	it('requires active transfers, tolerable requirements and no block', () => {
		assert.equal(payoutAccountEligible(ELIGIBLE), true);
		assert.equal(
			payoutAccountEligible({
				...ELIGIBLE,
				transfersStatus: PaymentAccountTransfersStatus.PENDING,
			}),
			false
		);
		assert.equal(
			payoutAccountEligible({
				...ELIGIBLE,
				requirementsStatus: PaymentAccountRequirementsStatus.PAST_DUE,
			}),
			false
		);
		assert.equal(
			payoutAccountEligible({
				...ELIGIBLE,
				payoutsBlockedReason: PayoutsBlockedReason.PAYOUT_FAILED,
			}),
			false
		);
	});

	it('numbers weekdays the ISO way and finds the next payout day', () => {
		const sunday = new Date('2026-10-18T09:00:00.000Z');
		const monday = new Date('2026-10-19T09:00:00.000Z');
		assert.equal(isoWeekday(sunday), 7);
		assert.equal(isoWeekday(monday), 1);
		assert.deepEqual(
			nextPayoutDate(sunday, 1),
			new Date('2026-10-19T00:00:00.000Z')
		);
		assert.deepEqual(
			nextPayoutDate(monday, 1),
			new Date('2026-10-26T00:00:00.000Z')
		);
	});

	it('identifies ISO weeks by the year of their Thursday', () => {
		assert.equal(isoWeekId(new Date('2026-10-21T23:59:59.000Z')), '2026-W43');
		assert.equal(isoWeekId(new Date('2026-10-19T00:00:00.000Z')), '2026-W43');
		assert.equal(isoWeekId(new Date('2026-10-25T12:00:00.000Z')), '2026-W43');
		assert.equal(isoWeekId(new Date('2027-01-01T00:00:00.000Z')), '2026-W53');
		assert.equal(isoWeekId(new Date('2024-12-30T00:00:00.000Z')), '2025-W01');
		assert.equal(isoWeekId(new Date('2026-01-05T00:00:00.000Z')), '2026-W02');
	});
});
