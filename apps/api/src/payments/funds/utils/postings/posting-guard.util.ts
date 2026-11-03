/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { MicroUsd } from '../../../../common/values/micro-usd.value';

export function assertNonNegative(name: string, ...amounts: MicroUsd[]): void {
	if (amounts.some((amount) => amount.isNegative())) {
		throw new Error(`${name} amounts must not be negative`);
	}
}

export function assertPositive(name: string, ...amounts: MicroUsd[]): void {
	assertNonNegative(name, ...amounts);
	if (amounts.every((amount) => amount.isZero())) {
		throw new Error(`${name} has nothing to post`);
	}
}
