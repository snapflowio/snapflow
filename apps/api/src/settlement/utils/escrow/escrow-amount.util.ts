/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MILLISECONDS_PER_SECOND } from '../../../common/constants/time.constants';
import { MicroUsd } from '../../../common/values/micro-usd.value';

export function chainSeconds(date: Date): bigint {
	return BigInt(Math.floor(date.getTime() / MILLISECONDS_PER_SECOND));
}

export function secondsUntil(
	deadline: Date | null,
	nowSeconds: bigint
): number | null {
	if (deadline === null) return null;
	return Number(maxBigInt(0n, chainSeconds(deadline) - nowSeconds));
}

export function microUsd(value: string): bigint {
	return MicroUsd.parse(value).toBigInt();
}

export function minBigInt(first: bigint, ...rest: bigint[]): bigint {
	return rest.reduce(
		// biome-ignore lint/complexity/useMathMinMax: bigint operands, which Math.min and Math.max reject
		(lowest, value) => (value < lowest ? value : lowest),
		first
	);
}

export function maxBigInt(first: bigint, ...rest: bigint[]): bigint {
	return rest.reduce(
		// biome-ignore lint/complexity/useMathMinMax: bigint operands, which Math.min and Math.max reject
		(highest, value) => (value > highest ? value : highest),
		first
	);
}
