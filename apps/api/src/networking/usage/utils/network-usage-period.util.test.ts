/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import {
	ratedEdgeSample,
	ratedReceipt,
} from '../testing/network-period.fixtures';
import {
	closedPeriodCutoff,
	groupUnratedEvidence,
	networkPeriodBytes,
} from './network-usage-period.util';

const HOUR = 3_600_000;
const SETTLE = 300_000;
const UNBOUNDED = Number.POSITIVE_INFINITY;
const FULL_BATCH = 3;

describe('network usage periods', () => {
	it('closes only whole hours that ended before the settle margin', () => {
		assert.deepEqual(
			closedPeriodCutoff(new Date('2026-10-18T11:04:59.000Z'), SETTLE, HOUR),
			new Date('2026-10-18T10:00:00.000Z')
		);
		assert.deepEqual(
			closedPeriodCutoff(new Date('2026-10-18T11:05:00.000Z'), SETTLE, HOUR),
			new Date('2026-10-18T11:00:00.000Z')
		);
	});

	it('groups evidence by lease and arrival hour', () => {
		const lease = randomUUID();
		const renewed = randomUUID();
		const periods = groupUnratedEvidence(
			[
				{
					kind: 'receipt',
					id: 'r1',
					leaseId: lease,
					periodStart: '2026-10-18T10:00:00.000Z',
				},
				{
					kind: 'edge',
					id: 'e1',
					leaseId: lease,
					periodStart: new Date('2026-10-18T10:00:00.000Z'),
				},
				{
					kind: 'receipt',
					id: 'r2',
					leaseId: renewed,
					periodStart: '2026-10-18T10:00:00.000Z',
				},
				{
					kind: 'receipt',
					id: 'r3',
					leaseId: lease,
					periodStart: '2026-10-18T09:00:00.000Z',
				},
			],
			UNBOUNDED
		);
		assert.deepEqual(
			periods.map(({ leaseId, periodStart, receiptIds, edgeIds }) => [
				leaseId,
				periodStart.toISOString(),
				receiptIds,
				edgeIds,
			]),
			[
				[lease, '2026-10-18T10:00:00.000Z', ['r1'], ['e1']],
				[renewed, '2026-10-18T10:00:00.000Z', ['r2'], []],
				[lease, '2026-10-18T09:00:00.000Z', ['r3'], []],
			]
		);
	});

	it('leaves the possibly partial last group of a full batch for the next batch', () => {
		const lease = randomUUID();
		const row = (id: string, periodStart: string) => ({
			kind: 'receipt' as const,
			id,
			leaseId: lease,
			periodStart,
		});
		const full = groupUnratedEvidence(
			[
				row('r1', '2026-10-18T09:00:00.000Z'),
				row('r2', '2026-10-18T10:00:00.000Z'),
				row('r3', '2026-10-18T10:00:00.000Z'),
			],
			FULL_BATCH
		);
		assert.deepEqual(
			full.map(({ receiptIds }) => receiptIds),
			[['r1']]
		);
		const single = groupUnratedEvidence(
			[
				row('r1', '2026-10-18T10:00:00.000Z'),
				row('r2', '2026-10-18T10:00:00.000Z'),
				row('r3', '2026-10-18T10:00:00.000Z'),
			],
			FULL_BATCH
		);
		assert.deepEqual(
			single.map(({ receiptIds }) => receiptIds),
			[['r1', 'r2', 'r3']]
		);
	});

	it('bills edge responses and direct internet egress once, never host-local relay bytes', () => {
		const bytes = networkPeriodBytes(
			[ratedReceipt(700n, 9_000n), ratedReceipt(300n, 1_000n)],
			[ratedEdgeSample(500n, true), ratedEdgeSample(4_000n, false)]
		);
		assert.equal(bytes.internetEgressBytes, 1_000n);
		assert.equal(bytes.edgeEgressBytes, 500n);
		assert.equal(bytes.billedEgressBytes, 1_500n);
		assert.equal(bytes.hostEgressBytes, 10_000n);
		assert.equal(bytes.internetIngressBytes, 3_000n);
		assert.equal(bytes.edgeIngressBytes, 1_000n);
	});
});
