/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { DISPLAY_LOCALE } from '#lib/utils/format.ts';
import { formatUsd } from '#lib/utils/usd.ts';

const FACT_SEPARATOR = ' · ';
const SHORT_DATE_FORMAT = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
	month: 'short',
	day: 'numeric',
});

export function automaticPayoutInfo(payoutMinimumMicroUsd: string): string {
	return `Each machine pays out automatically once it has ${formatUsd(payoutMinimumMicroUsd)} after the network fee.`;
}

export function belowMinimumLabel(payoutMinimumMicroUsd: string): string {
	return `Below ${formatUsd(payoutMinimumMicroUsd)} minimum`;
}

export function payoutMinimumInfo(payoutMinimumMicroUsd: string): string {
	return `Sends once a machine has ${formatUsd(payoutMinimumMicroUsd)} after the network fee. Smaller amounts roll over.`;
}

export function shortDate(value: string | Date): string {
	return SHORT_DATE_FORMAT.format(
		value instanceof Date ? value : new Date(value)
	);
}

export function joinFacts(
	facts: readonly (string | null | undefined)[]
): string {
	return facts.filter((fact) => fact).join(FACT_SEPARATOR);
}
