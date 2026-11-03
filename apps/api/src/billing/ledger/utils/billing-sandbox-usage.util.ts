/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { CursorPage } from '../../../common/dto/cursor-page.dto';
import { parseDatabaseTimestamp } from '../../../infra/database/utils/database-time.util';
import type { BillingSandboxUsageDto } from '../dto/billing.dto';
import {
	type SandboxUsageKeyset,
	type SandboxUsageRow,
	SandboxUsageSort,
} from '../queries/sandbox-usage.query';

const SIGNED_INTEGER_PATTERN = /^-?\d+$/;
const CURSOR_ERROR = 'Billing sandbox usage cursor is invalid';

interface SandboxUsageCursor extends SandboxUsageKeyset {
	sort: SandboxUsageSort;
}

export function sandboxUsagePage(
	rows: readonly SandboxUsageRow[],
	limit: number,
	sort: SandboxUsageSort
): CursorPage<BillingSandboxUsageDto> {
	const items = rows.slice(0, limit).map(toSandboxUsageDto);
	const last = items.at(-1);
	return {
		items,
		nextCursor:
			rows.length > limit && last
				? encodeSandboxUsageCursor({
						sort,
						value: sortValue(last, sort),
						sandboxId: last.sandboxId,
					})
				: null,
	};
}

export function decodeSandboxUsageCursor(
	cursor: string,
	sort: SandboxUsageSort
): SandboxUsageKeyset {
	const { sort: cursorSort, value, sandboxId } = parseCursor(cursor);
	if (
		cursorSort !== sort ||
		typeof sandboxId !== 'string' ||
		!isUUID(sandboxId) ||
		!isValidSortValue(value, sort)
	) {
		throw new BadRequestException(CURSOR_ERROR);
	}
	return { value, sandboxId };
}

export function toSandboxUsageDto(
	row: SandboxUsageRow
): BillingSandboxUsageDto {
	return {
		sandboxId: row.sandboxId,
		sandboxName: row.sandboxName ?? undefined,
		computeMicroUsd: row.computeMicroUsd,
		networkMicroUsd: row.networkMicroUsd,
		totalMicroUsd: row.totalMicroUsd,
		lineCount: row.lineCount,
		firstServiceStart: parseDatabaseTimestamp(row.firstServiceStart),
		lastServiceThrough: parseDatabaseTimestamp(row.lastServiceThrough),
		evidence: row.evidence,
	};
}

function encodeSandboxUsageCursor(cursor: SandboxUsageCursor): string {
	return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function parseCursor(cursor: string): Partial<Record<string, unknown>> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
	} catch {
		throw new BadRequestException(CURSOR_ERROR);
	}
	if (typeof parsed !== 'object' || parsed === null) {
		throw new BadRequestException(CURSOR_ERROR);
	}
	return { ...parsed };
}

function sortValue(
	usage: BillingSandboxUsageDto,
	sort: SandboxUsageSort
): string {
	return sort === SandboxUsageSort.TOTAL
		? usage.totalMicroUsd
		: usage.lastServiceThrough.toISOString();
}

function isValidSortValue(
	value: unknown,
	sort: SandboxUsageSort
): value is string {
	if (typeof value !== 'string') return false;
	return sort === SandboxUsageSort.TOTAL
		? SIGNED_INTEGER_PATTERN.test(value)
		: !Number.isNaN(Date.parse(value));
}
