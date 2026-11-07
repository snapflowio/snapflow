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
	MILLISECONDS_PER_HOUR,
	MILLISECONDS_PER_MINUTE,
} from '../../common/constants/time.constants';
import { MicroUsd } from '../../common/values/micro-usd.value';
import {
	type ClaimCandidate,
	isolateClaimable,
	selectClaims,
} from './claim-selection.util';
import { ZERO_VOUCHER_AMOUNTS } from './voucher-amounts.util';

const NOW = new Date('2026-11-05T12:00:00.000Z');
const INTERVAL = MILLISECONDS_PER_HOUR;
const LIMIT = 3;

interface NamedCandidate extends ClaimCandidate {
	name: string;
}

function candidate(
	name: string,
	overrides: Partial<ClaimCandidate> = {}
): NamedCandidate {
	return {
		name,
		amounts: { ...ZERO_VOUCHER_AMOUNTS, hostMicroUsd: MicroUsd.of(100n) },
		paid: ZERO_VOUCHER_AMOUNTS,
		claimableUntil: new Date(NOW.getTime() + 12 * MILLISECONDS_PER_HOUR),
		lastAttemptAt: new Date(NOW.getTime() - INTERVAL),
		...overrides,
	};
}

function names(candidates: readonly NamedCandidate[]): string[] {
	return candidates.map(({ name }) => name);
}

describe('selectClaims', () => {
	it('claims a channel once per interval', () => {
		const recent = candidate('recent', {
			lastAttemptAt: new Date(
				NOW.getTime() - INTERVAL + MILLISECONDS_PER_MINUTE
			),
		});
		assert.deepEqual(
			names(selectClaims([candidate('due'), recent], NOW, INTERVAL, LIMIT)),
			['due']
		);
	});

	it('claims a voucher early when it would expire before the next claim', () => {
		const urgent = candidate('urgent', {
			lastAttemptAt: NOW,
			claimableUntil: new Date(NOW.getTime() + INTERVAL - 1),
		});
		assert.deepEqual(
			names(selectClaims([candidate('due'), urgent], NOW, INTERVAL, LIMIT)),
			['urgent', 'due']
		);
	});

	it('skips vouchers already paid or no longer claimable', () => {
		const paid = candidate('paid');
		const expired = candidate('expired', { claimableUntil: NOW });
		assert.deepEqual(
			selectClaims(
				[{ ...paid, paid: paid.amounts }, expired],
				NOW,
				INTERVAL,
				LIMIT
			),
			[]
		);
	});

	it('bounds the batch, nearest deadline first', () => {
		const candidates = [4, 1, 3, 2].map((rank) =>
			candidate(`rank-${rank}`, {
				claimableUntil: new Date(NOW.getTime() + (rank + 1) * INTERVAL),
			})
		);
		assert.deepEqual(names(selectClaims(candidates, NOW, INTERVAL, LIMIT)), [
			'rank-1',
			'rank-2',
			'rank-3',
		]);
	});
});

describe('isolateClaimable', () => {
	it('accepts a batch the escrow takes as a whole with one simulation', async () => {
		let simulations = 0;
		const result = await isolateClaimable(['a', 'b'], async () => {
			simulations += 1;
			return null;
		});
		assert.deepEqual(result, { accepted: ['a', 'b'], rejected: [] });
		assert.equal(simulations, 1);
	});

	it('drops the voucher that fails and keeps the others', async () => {
		const result = await isolateClaimable(['a', 'stale', 'b'], async (batch) =>
			batch.includes('stale') ? 'StaleVoucher' : null
		);
		assert.deepEqual(result, {
			accepted: ['a', 'b'],
			rejected: [{ candidate: 'stale', reason: 'StaleVoucher' }],
		});
	});

	it('drops a voucher that only fails together with the accepted ones', async () => {
		const result = await isolateClaimable(
			['first', 'second', 'third'],
			async (batch) =>
				batch.includes('first') && batch.includes('second')
					? 'InsufficientBalance'
					: null
		);
		assert.deepEqual(result, {
			accepted: ['first', 'third'],
			rejected: [{ candidate: 'second', reason: 'InsufficientBalance' }],
		});
	});

	it('lets an unreachable chain abort the run', async () => {
		await assert.rejects(
			isolateClaimable(['a'], async () => {
				throw new Error('RPC unreachable');
			}),
			/RPC unreachable/
		);
	});
});
