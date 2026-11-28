/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MILLISECONDS_PER_HOUR } from '../../common/constants/time.constants';
import { MicroUsd } from '../../common/values/micro-usd.value';
import {
	BYTES_PER_GIBIBYTE,
	HOURS_PER_BILLING_MONTH,
} from '../../marketplace/constants/pricing.constants';
import { STORAGE_FREE_GIB } from '../constants/billing.constants';

const STORAGE_FREE_BYTES = STORAGE_FREE_GIB * BYTES_PER_GIBIBYTE;

export function utcHourStart(at: Date): Date {
	return new Date(
		Math.floor(at.getTime() / MILLISECONDS_PER_HOUR) * MILLISECONDS_PER_HOUR
	);
}

export function storageHourFee(
	storedBytes: bigint,
	microUsdPerGibMonth: bigint
): MicroUsd {
	if (storedBytes < 0n || microUsdPerGibMonth < 0n) {
		throw new Error('Stored bytes and the storage rate must be nonnegative');
	}
	const billableBytes =
		storedBytes > STORAGE_FREE_BYTES ? storedBytes - STORAGE_FREE_BYTES : 0n;
	return MicroUsd.of(
		(billableBytes * microUsdPerGibMonth) /
			(BYTES_PER_GIBIBYTE * HOURS_PER_BILLING_MONTH)
	);
}
