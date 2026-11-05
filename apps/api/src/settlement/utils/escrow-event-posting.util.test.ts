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
	BillingLedgerSourceType,
} from '../../billing/constants/billing.constants';
import {
	CHANNEL_ID,
	CUSTOMER_ADDRESS,
	escrowLog,
	HOST_ADDRESS,
} from '../testing/escrow-log.fixtures';
import type { EscrowLog } from '../types/escrow.types';
import {
	escrowEventPostable,
	escrowEventPosting,
	movesLedgerFunds,
	type PostableEscrowEvent,
} from './escrow-event-posting.util';
import { escrowEventRecord } from './escrow-event-record.util';

const CHAIN_ID = 31_337;
const CUSTOMER_ORGANIZATION = 'customer-organization';
const HOST_ORGANIZATION = 'host-organization';
const BLOCK_TIME = new Date('2026-11-05T12:00:00.000Z');

function event(
	log: EscrowLog,
	organizations: Partial<
		Pick<PostableEscrowEvent, 'customerOrganizationId' | 'hostOrganizationId'>
	> = {}
): PostableEscrowEvent {
	return {
		...escrowEventRecord(log),
		chainId: CHAIN_ID,
		blockTimestamp: BLOCK_TIME,
		customerOrganizationId: CUSTOMER_ORGANIZATION,
		hostOrganizationId: null,
		...organizations,
	};
}

const claim = escrowLog('Claimed', {
	channelId: CHANNEL_ID,
	customer: CUSTOMER_ADDRESS,
	host: HOST_ADDRESS,
	hostPaid: 70n,
	feePaid: 20n,
	servicePaid: 10n,
	sequence: 2n,
});

describe('escrowEventPosting', () => {
	it('posts a deposit to the customer organization at the block time', () => {
		const deposit = event(
			escrowLog('Deposited', {
				customer: CUSTOMER_ADDRESS,
				payer: CUSTOMER_ADDRESS,
				amount: 1_000n,
			})
		);
		const posting = escrowEventPosting(deposit);
		assert.equal(posting?.sourceType, BillingLedgerSourceType.ESCROW_DEPOSIT);
		assert.equal(
			posting?.sourceReference,
			`${CHAIN_ID}:${deposit.transactionHash}:${deposit.logIndex}`
		);
		assert.equal(posting?.effectiveAt, BLOCK_TIME);
		assert.equal(
			posting?.entries[1]?.account.ownerReference,
			CUSTOMER_ORGANIZATION
		);
	});

	it('splits a claim between the host and the fee wallet', () => {
		const posting = escrowEventPosting(
			event(claim, { hostOrganizationId: HOST_ORGANIZATION })
		);
		assert.deepEqual(
			posting?.entries.map(({ account, amount }) => [
				account.accountCode,
				amount,
			]),
			[
				[BillingLedgerAccountCode.HOST_EARNINGS_PENDING, '70'],
				[BillingLedgerAccountCode.PLATFORM_WALLET, '30'],
				[BillingLedgerAccountCode.ESCROW_CUSTODY, '100'],
			]
		);
	});

	it('posts nothing for a withdrawal of an emptied balance', () => {
		assert.equal(
			escrowEventPosting(
				event(
					escrowLog('Withdrawn', { customer: CUSTOMER_ADDRESS, amount: 0n })
				)
			),
			null
		);
	});
});

describe('escrowEventPostable', () => {
	it('waits for the customer organization', () => {
		const deposit = escrowLog('Deposited', {
			customer: CUSTOMER_ADDRESS,
			payer: CUSTOMER_ADDRESS,
			amount: 1n,
		});
		assert.equal(
			escrowEventPostable(event(deposit, { customerOrganizationId: null })),
			false
		);
		assert.equal(escrowEventPostable(event(deposit)), true);
	});

	it('waits for both parties of a claim', () => {
		assert.equal(escrowEventPostable(event(claim)), false);
		assert.equal(
			escrowEventPostable(
				event(claim, {
					customerOrganizationId: null,
					hostOrganizationId: HOST_ORGANIZATION,
				})
			),
			false
		);
		assert.equal(
			escrowEventPostable(
				event(claim, { hostOrganizationId: HOST_ORGANIZATION })
			),
			true
		);
	});
});

describe('movesLedgerFunds', () => {
	it('separates fund movements from account changes', () => {
		assert.equal(movesLedgerFunds('Deposited'), true);
		assert.equal(movesLedgerFunds('Withdrawn'), true);
		assert.equal(movesLedgerFunds('Claimed'), true);
		assert.equal(movesLedgerFunds('WithdrawalRequested'), false);
		assert.equal(movesLedgerFunds('SessionKeySet'), false);
	});
});
