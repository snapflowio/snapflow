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
import { BadRequestException } from '@nestjs/common';
import {
	type SandboxUsageRow,
	SandboxUsageSort,
} from '../queries/sandbox-usage.query';
import {
	decodeSandboxUsageCursor,
	sandboxUsagePage,
} from './billing-sandbox-usage.util';

const NEWER_SANDBOX_ID = '00000000-0000-4000-8000-000000000002';
const OLDER_SANDBOX_ID = '00000000-0000-4000-8000-000000000001';
const NEWER_SERVICE_THROUGH = '2026-10-02T10:00:00.123Z';
const NEWER_TOTAL = '120';
const PAGE_LIMIT = 1;

function row(sandboxId: string, lastServiceThrough: string): SandboxUsageRow {
	return {
		sandboxId,
		sandboxName: null,
		computeMicroUsd: '100',
		networkMicroUsd: '20',
		totalMicroUsd: NEWER_TOTAL,
		lineCount: 2,
		firstServiceStart: '2026-10-01T00:00:00.000Z',
		lastServiceThrough,
		evidence: { pending: 1, corroborated: 1 },
	};
}

const ROWS = [
	row(NEWER_SANDBOX_ID, NEWER_SERVICE_THROUGH),
	row(OLDER_SANDBOX_ID, '2026-10-01T10:00:00.000Z'),
];

function encode(value: unknown): string {
	return Buffer.from(JSON.stringify(value)).toString('base64url');
}

describe('sandboxUsagePage', () => {
	it('maps rows and keys the cursor on the last returned activity', () => {
		const page = sandboxUsagePage(
			ROWS,
			PAGE_LIMIT,
			SandboxUsageSort.LAST_ACTIVITY
		);

		assert.equal(page.items.length, PAGE_LIMIT);
		const [item] = page.items;
		assert.equal(item.sandboxId, NEWER_SANDBOX_ID);
		assert.equal(item.sandboxName, undefined);
		assert.equal(item.lastServiceThrough.toISOString(), NEWER_SERVICE_THROUGH);
		assert.equal(
			item.firstServiceStart.toISOString(),
			'2026-10-01T00:00:00.000Z'
		);
		assert.ok(page.nextCursor);
		assert.deepEqual(
			decodeSandboxUsageCursor(page.nextCursor, SandboxUsageSort.LAST_ACTIVITY),
			{ value: NEWER_SERVICE_THROUGH, sandboxId: NEWER_SANDBOX_ID }
		);
	});

	it('keys the cursor on the total when sorted by cost', () => {
		const page = sandboxUsagePage(ROWS, PAGE_LIMIT, SandboxUsageSort.TOTAL);

		assert.ok(page.nextCursor);
		assert.deepEqual(
			decodeSandboxUsageCursor(page.nextCursor, SandboxUsageSort.TOTAL),
			{ value: NEWER_TOTAL, sandboxId: NEWER_SANDBOX_ID }
		);
	});

	it('returns no cursor when the extra row is absent', () => {
		const page = sandboxUsagePage(
			[row(NEWER_SANDBOX_ID, NEWER_SERVICE_THROUGH)],
			PAGE_LIMIT,
			SandboxUsageSort.LAST_ACTIVITY
		);

		assert.equal(page.items.length, PAGE_LIMIT);
		assert.equal(page.nextCursor, null);
	});
});

describe('decodeSandboxUsageCursor', () => {
	it('rejects a cursor issued for another sort', () => {
		const cursor = sandboxUsagePage(
			ROWS,
			PAGE_LIMIT,
			SandboxUsageSort.TOTAL
		).nextCursor;
		assert.ok(cursor);

		assert.throws(
			() => decodeSandboxUsageCursor(cursor, SandboxUsageSort.LAST_ACTIVITY),
			BadRequestException
		);
	});

	it('rejects malformed cursors', () => {
		const { TOTAL, LAST_ACTIVITY } = SandboxUsageSort;
		const malformed = [
			['not-base64-json', TOTAL],
			[encode(null), TOTAL],
			[
				encode({ sort: TOTAL, value: '1.5', sandboxId: NEWER_SANDBOX_ID }),
				TOTAL,
			],
			[
				encode({ sort: TOTAL, value: NEWER_TOTAL, sandboxId: 'sandbox' }),
				TOTAL,
			],
			[
				encode({
					sort: LAST_ACTIVITY,
					value: 'yesterday',
					sandboxId: NEWER_SANDBOX_ID,
				}),
				LAST_ACTIVITY,
			],
		] as const;

		for (const [cursor, sort] of malformed) {
			assert.throws(
				() => decodeSandboxUsageCursor(cursor, sort),
				BadRequestException
			);
		}
	});
});
