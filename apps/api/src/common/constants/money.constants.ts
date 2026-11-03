/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const MICRO_USD_PATTERN = /^\d+$/;
export const MICRO_USD_DECIMALS = 6;
export const MICRO_USD_PER_USD = 10n ** BigInt(MICRO_USD_DECIMALS);
export const MICRO_USD_PER_CENT = 10_000n;
export const BASIS_POINTS_SCALE = 10_000;
export const BASIS_POINTS_DENOMINATOR = BigInt(BASIS_POINTS_SCALE);

export const RoundingMode = {
	FLOOR: 'floor',
	CEIL: 'ceil',
} as const;

export type RoundingMode = (typeof RoundingMode)[keyof typeof RoundingMode];
