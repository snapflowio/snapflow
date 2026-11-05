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
import { keccak256, toHex } from 'viem';
import { MAXIMUM_DATE_MILLISECONDS } from '../constants/escrow.constants';
import {
	CHANNEL_ID,
	CUSTOMER_ADDRESS,
	escrowLog,
	HOST_ADDRESS,
} from '../testing/escrow-log.fixtures';
import {
	chainTimestamp,
	escrowEventRecord,
	escrowSourceReference,
} from './escrow-event-record.util';

describe('escrowEventRecord', () => {
	it('stores a deposit with its amount as a decimal string', () => {
		const record = escrowEventRecord(
			escrowLog(
				'Deposited',
				{
					customer: CUSTOMER_ADDRESS,
					payer: HOST_ADDRESS,
					amount: 2n ** 200n,
				},
				{ blockNumber: 42n, logIndex: 7 }
			)
		);
		assert.equal(record.kind, 'Deposited');
		assert.deepEqual(record.args, {
			customer: CUSTOMER_ADDRESS,
			payer: HOST_ADDRESS,
			amount: (2n ** 200n).toString(),
		});
		assert.equal(record.customerAddress, CUSTOMER_ADDRESS);
		assert.equal(record.hostAddress, null);
		assert.equal(record.blockNumber, 42);
		assert.equal(record.logIndex, 7);
	});

	it('names both parties of a claim', () => {
		const record = escrowEventRecord(
			escrowLog('Claimed', {
				channelId: CHANNEL_ID,
				customer: CUSTOMER_ADDRESS,
				host: HOST_ADDRESS,
				hostPaid: 80n,
				feePaid: 15n,
				servicePaid: 5n,
				sequence: 3n,
			})
		);
		assert.equal(record.customerAddress, CUSTOMER_ADDRESS);
		assert.equal(record.hostAddress, HOST_ADDRESS);
		assert.equal(record.args.hostPaid, '80');
		assert.equal(record.args.sequence, '3');
	});

	it('concerns both wallets of a blocked address', () => {
		const record = escrowEventRecord(
			escrowLog('AddressBlocked', { account: HOST_ADDRESS })
		);
		assert.equal(record.customerAddress, HOST_ADDRESS);
		assert.equal(record.hostAddress, HOST_ADDRESS);
	});

	it('attributes administrative events to nobody', () => {
		const record = escrowEventRecord(
			escrowLog('FeeCapUpdated', { previousBps: 2_500, bps: 3_000 })
		);
		assert.equal(record.customerAddress, null);
		assert.equal(record.hostAddress, null);
		assert.deepEqual(record.args, { previousBps: '2500', bps: '3000' });
	});
});

describe('escrowSourceReference', () => {
	it('identifies a log by chain, transaction and position', () => {
		const transactionHash = keccak256(toHex('claim'));
		assert.equal(
			escrowSourceReference({ chainId: 8453, transactionHash, logIndex: 4 }),
			`8453:${transactionHash}:4`
		);
	});
});

describe('chainTimestamp', () => {
	it('converts unix seconds', () => {
		assert.equal(
			chainTimestamp(1_700_000_000n).toISOString(),
			'2023-11-14T22:13:20.000Z'
		);
	});

	it('holds an expiry beyond what a Date can represent at the latest instant', () => {
		assert.equal(
			chainTimestamp(2n ** 64n - 1n).getTime(),
			MAXIMUM_DATE_MILLISECONDS
		);
	});
});
