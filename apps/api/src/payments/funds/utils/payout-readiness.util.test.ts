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
import { PayoutsBlockedReason } from '../constants/payments.constants';
import {
	PaymentAccountRequirementsStatus,
	PaymentAccountTransfersStatus,
} from '../enums/payment-account-status.enum';
import { PayoutReadiness } from '../enums/payout-readiness.enum';
import { payoutReadiness } from './payout-readiness.util';

const READY_ACCOUNT = {
	transfersStatus: PaymentAccountTransfersStatus.ACTIVE,
	requirementsStatus: PaymentAccountRequirementsStatus.NONE,
	payoutsBlockedReason: null,
};

describe('payout readiness', () => {
	it('reports a missing account as not set up', () => {
		assert.equal(payoutReadiness(null), PayoutReadiness.NOT_SET_UP);
	});

	it('reports an account the payout job would pay as ready', () => {
		assert.equal(payoutReadiness(READY_ACCOUNT), PayoutReadiness.READY);
	});

	it('asks for action when Stripe needs information or payouts are blocked', () => {
		for (const account of [
			{
				...READY_ACCOUNT,
				requirementsStatus: PaymentAccountRequirementsStatus.CURRENTLY_DUE,
			},
			{
				...READY_ACCOUNT,
				requirementsStatus: PaymentAccountRequirementsStatus.PAST_DUE,
			},
			{
				...READY_ACCOUNT,
				transfersStatus: PaymentAccountTransfersStatus.RESTRICTED,
			},
			{
				...READY_ACCOUNT,
				payoutsBlockedReason: PayoutsBlockedReason.PAYOUT_FAILED,
			},
		]) {
			assert.equal(payoutReadiness(account), PayoutReadiness.ACTION_REQUIRED);
		}
	});

	it('reports onboarding that Stripe is still reviewing as pending', () => {
		for (const transfersStatus of [
			PaymentAccountTransfersStatus.PENDING,
			PaymentAccountTransfersStatus.INACTIVE,
		]) {
			assert.equal(
				payoutReadiness({ ...READY_ACCOUNT, transfersStatus }),
				PayoutReadiness.PENDING
			);
		}
	});
});
