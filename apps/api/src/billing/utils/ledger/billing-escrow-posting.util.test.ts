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
import type { BillingLedgerPosting } from '../../services/billing-ledger.service';
import {
	escrowClaimPosting,
	escrowDepositPosting,
	escrowWithdrawalPosting,
} from './billing-escrow-posting.util';

const SOURCE = {
	sourceReference: '8453:0xabc:3',
	effectiveAt: new Date('2026-11-01T00:00:00.000Z'),
	metadata: { kind: 'test' },
};
const CUSTOMER = 'customer-organization';
const HOST = 'host-organization';

function entries(posting: BillingLedgerPosting) {
	return posting.entries.map(({ account, side, amount }) => [
		account.ownerReference,
		account.accountCode,
		side,
		amount,
	]);
}

describe('escrow postings', () => {
	it('moves a deposit from custody into customer credit', () => {
		const posting = escrowDepositPosting({
			...SOURCE,
			organizationId: CUSTOMER,
			amountMicroUsd: MicroUsd.of(5_000_000n),
		});
		assert.equal(posting.sourceType, BillingLedgerSourceType.ESCROW_DEPOSIT);
		assert.equal(posting.sourceReference, SOURCE.sourceReference);
		assert.deepEqual(entries(posting), [
			[
				'snapflow',
				BillingLedgerAccountCode.ESCROW_CUSTODY,
				BillingLedgerSide.DEBIT,
				'5000000',
			],
			[
				CUSTOMER,
				BillingLedgerAccountCode.CUSTOMER_CREDIT,
				BillingLedgerSide.CREDIT,
				'5000000',
			],
		]);
	});

	it('reverses a deposit for a withdrawal', () => {
		const posting = escrowWithdrawalPosting({
			...SOURCE,
			organizationId: CUSTOMER,
			amountMicroUsd: MicroUsd.of(7n),
		});
		assert.equal(posting.sourceType, BillingLedgerSourceType.ESCROW_WITHDRAWAL);
		assert.deepEqual(entries(posting), [
			[
				CUSTOMER,
				BillingLedgerAccountCode.CUSTOMER_CREDIT,
				BillingLedgerSide.DEBIT,
				'7',
			],
			[
				'snapflow',
				BillingLedgerAccountCode.ESCROW_CUSTODY,
				BillingLedgerSide.CREDIT,
				'7',
			],
		]);
	});

	it('settles a claim from custody to the host and the fee wallet', () => {
		const posting = escrowClaimPosting({
			...SOURCE,
			hostOrganizationId: HOST,
			hostMicroUsd: MicroUsd.of(80n),
			platformMicroUsd: MicroUsd.of(20n),
		});
		assert.equal(posting.sourceType, BillingLedgerSourceType.ESCROW_CLAIM);
		assert.deepEqual(entries(posting), [
			[
				HOST,
				BillingLedgerAccountCode.HOST_EARNINGS_PENDING,
				BillingLedgerSide.DEBIT,
				'80',
			],
			[
				'snapflow',
				BillingLedgerAccountCode.PLATFORM_WALLET,
				BillingLedgerSide.DEBIT,
				'20',
			],
			[
				'snapflow',
				BillingLedgerAccountCode.ESCROW_CUSTODY,
				BillingLedgerSide.CREDIT,
				'100',
			],
		]);
	});

	it('omits the side of a claim that paid nothing', () => {
		const posting = escrowClaimPosting({
			...SOURCE,
			hostOrganizationId: HOST,
			hostMicroUsd: MicroUsd.ZERO,
			platformMicroUsd: MicroUsd.of(3n),
		});
		assert.equal(posting.entries.length, 2);
	});

	it('settles a platform service claim without a host organization', () => {
		const posting = escrowClaimPosting({
			...SOURCE,
			hostOrganizationId: null,
			hostMicroUsd: MicroUsd.ZERO,
			platformMicroUsd: MicroUsd.of(5_000_000n),
		});
		assert.deepEqual(entries(posting), [
			[
				'snapflow',
				BillingLedgerAccountCode.PLATFORM_WALLET,
				BillingLedgerSide.DEBIT,
				'5000000',
			],
			[
				'snapflow',
				BillingLedgerAccountCode.ESCROW_CUSTODY,
				BillingLedgerSide.CREDIT,
				'5000000',
			],
		]);
	});

	it('refuses a claim paying a host it cannot attribute', () => {
		assert.throws(
			() =>
				escrowClaimPosting({
					...SOURCE,
					hostOrganizationId: null,
					hostMicroUsd: MicroUsd.of(1n),
					platformMicroUsd: MicroUsd.ZERO,
				}),
			/pays a host without an organization/
		);
	});

	it('refuses an event that moves nothing', () => {
		assert.throws(() =>
			escrowDepositPosting({
				...SOURCE,
				organizationId: CUSTOMER,
				amountMicroUsd: MicroUsd.ZERO,
			})
		);
	});
});
