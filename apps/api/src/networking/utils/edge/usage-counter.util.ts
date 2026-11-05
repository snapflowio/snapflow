/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { UnprocessableEntityException } from '@nestjs/common';
import { NETWORK_USAGE_MAXIMUM_COUNTER } from '../../usage/constants/network-usage.constants';

export function parseSupportedUsageCounter(
	value: string,
	name: string,
	positive = false
): bigint {
	const parsed = BigInt(value);
	if (
		parsed < 0n ||
		parsed > NETWORK_USAGE_MAXIMUM_COUNTER ||
		(positive && parsed === 0n)
	) {
		throw new UnprocessableEntityException(
			`Network usage ${name} exceeds the supported range`
		);
	}
	return parsed;
}
