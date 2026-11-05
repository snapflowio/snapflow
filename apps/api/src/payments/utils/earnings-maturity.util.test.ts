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
import { MachineTier } from '../../marketplace/enums/machine-tier.enum';
import {
	earningsMaturesAt,
	newFundingUntil,
	payoutHoldDays,
} from './earnings-maturity.util';

const HOLDS = {
	payoutHoldCommunityDays: 14,
	payoutHoldVerifiedDays: 7,
	payoutHoldDatacenterDays: 3,
};
const RECONCILED_AT = new Date('2026-10-01T10:00:00.000Z');

describe('earnings maturity', () => {
	it('holds earnings by machine tier', () => {
		assert.equal(payoutHoldDays(MachineTier.COMMUNITY, HOLDS), 14);
		assert.equal(payoutHoldDays(MachineTier.PRIVATE, HOLDS), 14);
		assert.equal(payoutHoldDays(MachineTier.VERIFIED, HOLDS), 7);
		assert.equal(payoutHoldDays(MachineTier.DATACENTER, HOLDS), 3);
	});

	it('matures at reconciliation plus the hold without new funding', () => {
		assert.deepEqual(
			earningsMaturesAt({
				reconciledAt: RECONCILED_AT,
				holdDays: 7,
				newFundingUntil: null,
			}),
			new Date('2026-10-08T10:00:00.000Z')
		);
	});

	it('waits for the new-funding hold when the usage predates it', () => {
		const fundingUntil = new Date('2026-10-20T00:00:00.000Z');
		assert.deepEqual(
			earningsMaturesAt({
				reconciledAt: RECONCILED_AT,
				holdDays: 3,
				newFundingUntil: fundingUntil,
			}),
			fundingUntil
		);
	});

	it('ignores a new-funding hold that ended before the usage', () => {
		assert.deepEqual(
			earningsMaturesAt({
				reconciledAt: RECONCILED_AT,
				holdDays: 3,
				newFundingUntil: new Date('2026-09-30T00:00:00.000Z'),
			}),
			new Date('2026-10-04T10:00:00.000Z')
		);
	});

	it('keeps the tier hold when it outlasts the new-funding hold', () => {
		assert.deepEqual(
			earningsMaturesAt({
				reconciledAt: RECONCILED_AT,
				holdDays: 14,
				newFundingUntil: new Date('2026-10-05T00:00:00.000Z'),
			}),
			new Date('2026-10-15T10:00:00.000Z')
		);
	});

	it('derives the new-funding hold from the newest first charge', () => {
		assert.equal(newFundingUntil([], 30), null);
		assert.deepEqual(
			newFundingUntil(
				[
					new Date('2026-09-01T00:00:00.000Z'),
					new Date('2026-09-15T00:00:00.000Z'),
				],
				30
			),
			new Date('2026-10-15T00:00:00.000Z')
		);
	});
});
