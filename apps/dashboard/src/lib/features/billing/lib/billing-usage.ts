/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	BillingSandboxUsageDto,
	ListBillingSandboxUsageData,
} from '@snapflow/api-client';
import { DISPLAY_LOCALE } from '#lib/utils/format.ts';

type SandboxUsageSort = NonNullable<
	NonNullable<ListBillingSandboxUsageData['query']>['sort']
>;
type SandboxUsageDirection = NonNullable<
	NonNullable<ListBillingSandboxUsageData['query']>['direction']
>;

export const HIGHEST_COST_FIRST = {
	sort: 'total',
	direction: 'desc',
} as const satisfies {
	sort: SandboxUsageSort;
	direction: SandboxUsageDirection;
};

const SHORT_SANDBOX_ID_LENGTH = 8;

const SERVICE_WINDOW_FORMAT = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
	day: 'numeric',
	hour: 'numeric',
	minute: '2-digit',
	month: 'short',
});

export function sandboxUsageTitle(
	usage: Pick<BillingSandboxUsageDto, 'sandboxId' | 'sandboxName'>
): string {
	return usage.sandboxName ?? usage.sandboxId.slice(0, SHORT_SANDBOX_ID_LENGTH);
}

export function formatServiceWindow(start: Date | string, end: Date | string) {
	return SERVICE_WINDOW_FORMAT.formatRange(new Date(start), new Date(end));
}

export const DELETED_SANDBOX_LABEL = 'Deleted';
const MINIMUM_SHARE_PERCENT = 2;
const PERCENT = 100;

export function sandboxUsageSharePercent(
	row: BillingSandboxUsageDto,
	totalMicroUsd: string
): number {
	const total = Number(totalMicroUsd);
	if (total <= 0) return 0;
	return Math.min(
		PERCENT,
		Math.max(
			MINIMUM_SHARE_PERCENT,
			Math.round((Number(row.totalMicroUsd) / total) * PERCENT)
		)
	);
}
