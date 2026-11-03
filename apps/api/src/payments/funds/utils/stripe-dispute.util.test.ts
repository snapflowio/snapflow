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
import { DisputeState } from '../enums/dispute-state.enum';
import {
	disputeFreezeMicroUsd,
	disputeLossMicroUsd,
	disputeReinstatements,
	disputeState,
	disputeWithdrawals,
	shouldFreezeDisputedCredit,
} from './stripe-dispute.util';

const WITHDRAWAL = {
	id: 'txn_w',
	amount: -2_500,
	fee: 1_500,
	currency: 'usd',
	created: 1_760_000_000,
};
const REINSTATEMENT = {
	id: 'txn_r',
	amount: 2_500,
	fee: -1_500,
	currency: 'usd',
	created: 1_760_100_000,
};

describe('dispute amounts', () => {
	it('maps Stripe statuses onto the four dispute states', () => {
		assert.equal(
			disputeState('warning_needs_response'),
			DisputeState.NEEDS_RESPONSE
		);
		assert.equal(disputeState('under_review'), DisputeState.UNDER_REVIEW);
		assert.equal(disputeState('won'), DisputeState.WON);
		assert.equal(disputeState('lost'), DisputeState.LOST);
	});

	it('reads the disputed amount and fee from the withdrawal', () => {
		assert.deepEqual(disputeWithdrawals([WITHDRAWAL, REINSTATEMENT]), [
			{
				balanceTransactionId: 'txn_w',
				disputedMicroUsd: MicroUsd.of(25_000_000n),
				feeMicroUsd: MicroUsd.of(15_000_000n),
				effectiveAt: new Date(1_760_000_000_000),
			},
		]);
	});

	it('restores frozen credit once across reinstatements', () => {
		const [reinstatement] = disputeReinstatements(
			[REINSTATEMENT],
			MicroUsd.of(10_000_000n)
		);
		assert.deepEqual(
			reinstatement?.reinstatedMicroUsd,
			MicroUsd.of(25_000_000n)
		);
		assert.deepEqual(reinstatement?.restoredMicroUsd, MicroUsd.of(10_000_000n));
		assert.deepEqual(
			reinstatement?.feeRefundMicroUsd,
			MicroUsd.of(15_000_000n)
		);
	});

	it('freezes at most the spendable credit and loses the rest', () => {
		assert.deepEqual(
			disputeFreezeMicroUsd(MicroUsd.of(25_000_000n), MicroUsd.of(10_000_000n)),
			MicroUsd.of(10_000_000n)
		);
		assert.deepEqual(
			disputeFreezeMicroUsd(MicroUsd.of(25_000_000n), MicroUsd.of(40_000_000n)),
			MicroUsd.of(25_000_000n)
		);
		assert.deepEqual(
			disputeFreezeMicroUsd(MicroUsd.of(25_000_000n), MicroUsd.ZERO),
			MicroUsd.ZERO
		);
		assert.deepEqual(
			disputeLossMicroUsd([WITHDRAWAL], MicroUsd.of(10_000_000n)),
			MicroUsd.of(15_000_000n)
		);
		assert.deepEqual(disputeLossMicroUsd([], MicroUsd.ZERO), MicroUsd.ZERO);
	});

	it('freezes credit only while withdrawn funds are neither reinstated nor won', () => {
		assert.equal(
			shouldFreezeDisputedCredit([WITHDRAWAL], DisputeState.NEEDS_RESPONSE),
			true
		);
		assert.equal(
			shouldFreezeDisputedCredit([WITHDRAWAL], DisputeState.LOST),
			true
		);
		assert.equal(
			shouldFreezeDisputedCredit([WITHDRAWAL], DisputeState.WON),
			false
		);
		assert.equal(
			shouldFreezeDisputedCredit(
				[REINSTATEMENT, WITHDRAWAL],
				DisputeState.UNDER_REVIEW
			),
			false
		);
		assert.equal(
			shouldFreezeDisputedCredit([], DisputeState.NEEDS_RESPONSE),
			false
		);
	});
});
