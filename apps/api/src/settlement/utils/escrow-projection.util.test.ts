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
import {
	CHANNEL_ID,
	CUSTOMER_ADDRESS,
	escrowLog,
	HOST_ADDRESS,
	KEY_ADDRESS,
} from '../testing/escrow-log.fixtures';
import type { EscrowLog } from '../types/escrow.types';
import {
	EMPTY_ESCROW_ACCOUNT,
	type EscrowAccountState,
	escrowAccountAddress,
	projectEscrowAccount,
	sessionKeyChange,
} from './escrow-projection.util';

const READY_AT_SECONDS = 1_800_000_000n;
const BLOCK_TIME = new Date('2026-11-05T12:00:00.000Z');

function fold(logs: readonly EscrowLog[]): EscrowAccountState {
	return logs.reduce(projectEscrowAccount, EMPTY_ESCROW_ACCOUNT);
}

const deposit = (amount: bigint) =>
	escrowLog('Deposited', {
		customer: CUSTOMER_ADDRESS,
		payer: CUSTOMER_ADDRESS,
		amount,
	});

const requestWithdrawal = (amount: bigint) =>
	escrowLog('WithdrawalRequested', {
		customer: CUSTOMER_ADDRESS,
		amount,
		readyAt: READY_AT_SECONDS,
	});

const claim = escrowLog('Claimed', {
	channelId: CHANNEL_ID,
	customer: CUSTOMER_ADDRESS,
	host: HOST_ADDRESS,
	hostPaid: 10n,
	feePaid: 15n,
	servicePaid: 5n,
	sequence: 1n,
});

describe('projectEscrowAccount', () => {
	it('mirrors deposits minus claims minus withdrawals', () => {
		const state = fold([
			deposit(100n),
			claim,
			requestWithdrawal(20n),
			escrowLog('Withdrawn', { customer: CUSTOMER_ADDRESS, amount: 20n }),
		]);
		assert.deepEqual(state.balanceMicroUsd, MicroUsd.of(50n));
		assert.deepEqual(state.pendingWithdrawalMicroUsd, MicroUsd.ZERO);
		assert.equal(state.withdrawalReadyAt, null);
	});

	it('tracks the latest withdrawal request until it is cancelled', () => {
		const pending = fold([
			deposit(100n),
			requestWithdrawal(60n),
			requestWithdrawal(40n),
		]);
		assert.deepEqual(pending.pendingWithdrawalMicroUsd, MicroUsd.of(40n));
		assert.equal(
			pending.withdrawalReadyAt?.toISOString(),
			'2027-01-15T08:00:00.000Z'
		);
		const cancelled = projectEscrowAccount(
			pending,
			escrowLog('WithdrawalCancelled', { customer: CUSTOMER_ADDRESS })
		);
		assert.deepEqual(cancelled.pendingWithdrawalMicroUsd, MicroUsd.ZERO);
		assert.equal(cancelled.withdrawalReadyAt, null);
		assert.deepEqual(cancelled.balanceMicroUsd, MicroUsd.of(100n));
	});

	it('follows blocks and unblocks', () => {
		const blocked = fold([
			escrowLog('AddressBlocked', { account: CUSTOMER_ADDRESS }),
		]);
		assert.equal(blocked.blocked, true);
		assert.equal(
			projectEscrowAccount(
				blocked,
				escrowLog('AddressUnblocked', { account: CUSTOMER_ADDRESS })
			).blocked,
			false
		);
	});
});

describe('escrowAccountAddress', () => {
	it("moves the customer's balance on a claim, not the host's", () => {
		assert.equal(escrowAccountAddress(claim), CUSTOMER_ADDRESS);
	});

	it('changes no account for a session key', () => {
		assert.equal(
			escrowAccountAddress(
				escrowLog('SessionKeyRevoked', {
					customer: CUSTOMER_ADDRESS,
					key: KEY_ADDRESS,
				})
			),
			null
		);
	});
});

describe('sessionKeyChange', () => {
	it('activates a key with its limits in the block that sets it', () => {
		assert.deepEqual(
			sessionKeyChange(
				escrowLog('SessionKeySet', {
					customer: CUSTOMER_ADDRESS,
					key: KEY_ADDRESS,
					spendCap: 1_000_000n,
					hourlyCap: 100_000n,
					expiry: READY_AT_SECONDS,
				}),
				BLOCK_TIME
			),
			{
				granted: {
					customerAddress: CUSTOMER_ADDRESS,
					keyAddress: KEY_ADDRESS,
					spendCapMicroUsd: '1000000',
					hourlyCapMicroUsd: '100000',
					expiresAt: new Date('2027-01-15T08:00:00.000Z'),
					activatedAt: BLOCK_TIME,
				},
			}
		);
	});

	it('revokes a key at the block time', () => {
		assert.deepEqual(
			sessionKeyChange(
				escrowLog('SessionKeyRevoked', {
					customer: CUSTOMER_ADDRESS,
					key: KEY_ADDRESS,
				}),
				BLOCK_TIME
			),
			{
				revoked: {
					customerAddress: CUSTOMER_ADDRESS,
					keyAddress: KEY_ADDRESS,
					revokedAt: BLOCK_TIME,
				},
			}
		);
	});

	it('ignores events that are not about session keys', () => {
		assert.equal(sessionKeyChange(deposit(1n), BLOCK_TIME), null);
	});
});
