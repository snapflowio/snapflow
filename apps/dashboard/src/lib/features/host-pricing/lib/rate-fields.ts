/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { RatePercentiles } from '@snapflow/api-client';
import { formatRate } from '#lib/utils/usd.ts';
import type { HostRateKey } from './host-rates.ts';

interface RateField {
	key: HostRateKey;
	label: string;
	unit: string;
	gpu: boolean;
}

export const HOST_RATE_FIELDS = [
	{ key: 'vcpuHourMicroUsd', label: 'vCPU', unit: 'vCPU-hour', gpu: false },
	{
		key: 'memoryGibHourMicroUsd',
		label: 'Memory',
		unit: 'GiB-hour',
		gpu: false,
	},
	{ key: 'gpuHourMicroUsd', label: 'GPU', unit: 'GPU-hour', gpu: true },
	{
		key: 'diskGibMonthMicroUsd',
		label: 'Disk',
		unit: 'GiB-month',
		gpu: false,
	},
] as const satisfies readonly RateField[];

export function hostRateFields(hasGpus: boolean): readonly RateField[] {
	return HOST_RATE_FIELDS.filter((field) => hasGpus || !field.gpu);
}

export function formatRatePer(microUsd: string, unit: string): string {
	return `${formatRate(microUsd)}/${unit}`;
}

export function marketMedianHint(
	percentiles: RatePercentiles | null,
	unit: string
): string {
	return percentiles
		? `Comparable machines: median ${formatRatePer(percentiles.median, unit)}`
		: 'No comparable machines ask this rate yet';
}

export const HOST_PRICE_SHARE_NOTE =
	'You keep 100% of your rates. Renters pay your rates plus the Snapflow fee.';
