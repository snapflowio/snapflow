/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BPS_DENOMINATOR } from '@snapflow/contracts';
import { formatBasisPointsPercent } from '#lib/utils/format.ts';

export function markupBpsOfFeeBps(feeBps: number): number {
	return Math.ceil((feeBps * BPS_DENOMINATOR) / (BPS_DENOMINATOR - feeBps));
}

export function markupPercentOfFeeBps(feeBps: number): string {
	return formatBasisPointsPercent(markupBpsOfFeeBps(feeBps));
}

export function feeConsentNote(feeBps: number): string {
	return `Snapflow's ${markupPercentOfFeeBps(feeBps)} markup, already included in listed prices, is taken from each payment; it is not an extra charge.`;
}
