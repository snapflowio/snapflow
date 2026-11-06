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
import {
	BillingLedgerAccountCode,
	BillingLedgerSide,
	BillingLedgerSourceType,
} from '../../constants/billing.constants';
import { privatePoolPosting } from './billing-private-pool-posting.util';

const CHARGE = {
	id: 'charge-id',
	organizationId: 'customer-organization',
	machineId: 'machine-id',
	serviceDay: new Date('2026-11-05T00:00:00.000Z'),
	amountMicroUsd: '166667',
};

describe('privatePoolPosting', () => {
	it('moves the day fee from customer credit to service revenue', () => {
		const posting = privatePoolPosting(CHARGE);
		assert.equal(posting.sourceType, BillingLedgerSourceType.PRIVATE_POOL_FEE);
		assert.equal(posting.sourceReference, CHARGE.id);
		assert.equal(posting.effectiveAt, CHARGE.serviceDay);
		assert.deepEqual(
			posting.entries.map(({ account, side, amount }) => [
				account.ownerReference,
				account.accountCode,
				side,
				amount,
			]),
			[
				[
					CHARGE.organizationId,
					BillingLedgerAccountCode.CUSTOMER_CREDIT,
					BillingLedgerSide.DEBIT,
					'166667',
				],
				[
					'snapflow',
					BillingLedgerAccountCode.PLATFORM_SERVICE_REVENUE,
					BillingLedgerSide.CREDIT,
					'166667',
				],
			]
		);
	});

	it('refuses a charge of nothing', () => {
		assert.throws(() => privatePoolPosting({ ...CHARGE, amountMicroUsd: '0' }));
	});
});
