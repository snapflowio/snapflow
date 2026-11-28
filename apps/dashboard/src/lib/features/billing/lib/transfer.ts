/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { NetworkUsagePeriod } from '@snapflow/api-client';
import { DECIMAL_BASE } from '#lib/utils/usd.ts';

const BYTES_PER_GIBIBYTE = 1_073_741_824n;
const BYTE_FRACTION_DIGITS = 2;
const BYTE_FRACTION_SCALE = DECIMAL_BASE ** BigInt(BYTE_FRACTION_DIGITS);

export const BINARY_UNITS_NOTE =
	'GB and TB are binary units: 1 GB is 1,073,741,824 bytes and 1 TB is 1,024 GB.';

export function formatTransferBytes(bytes: string): string {
	const scaled = (BigInt(bytes) * BYTE_FRACTION_SCALE) / BYTES_PER_GIBIBYTE;
	const whole = scaled / BYTE_FRACTION_SCALE;
	const fraction = (scaled % BYTE_FRACTION_SCALE)
		.toString()
		.padStart(BYTE_FRACTION_DIGITS, '0');
	return `${whole}.${fraction} GB`;
}

export function egressBytes(
	period: Pick<NetworkUsagePeriod, 'edgeEgressBytes' | 'internetEgressBytes'>
): string {
	return (
		BigInt(period.edgeEgressBytes) + BigInt(period.internetEgressBytes)
	).toString();
}
