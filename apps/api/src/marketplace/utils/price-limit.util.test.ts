/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { SETTINGS_DEFAULTS } from '../../settings/constants/settings.constants';
import { PricedResource } from '../enums/priced-resource.enum';
import type { PriceCardRates } from '../types/pricing.types';
import { priceRangeViolation } from './price-limit.util';

const CPU_MACHINE_GPUS = 0;
const GPU_MACHINE_GPUS = 1;

const CARD: PriceCardRates = {
	vcpuHourMicroUsd: '10000',
	memoryGibHourMicroUsd: '2000',
	gpuHourMicroUsd: '0',
	diskGibMonthMicroUsd: '73000',
	stoppedDiskGibMonthMicroUsd: '36500',
	egressMicroUsdPerGiB: '0',
};

describe('priceRangeViolation', () => {
	it('accepts a card inside every limit, with free egress', () => {
		assert.equal(
			priceRangeViolation(CARD, SETTINGS_DEFAULTS, CPU_MACHINE_GPUS),
			null
		);
	});

	it('accepts the limits themselves', () => {
		assert.equal(
			priceRangeViolation(
				{
					...CARD,
					vcpuHourMicroUsd: '1000',
					memoryGibHourMicroUsd: '100000',
					gpuHourMicroUsd: '20000000',
				},
				SETTINGS_DEFAULTS,
				GPU_MACHINE_GPUS
			),
			null
		);
	});

	it('names the resource below its minimum and the allowed range', () => {
		assert.deepEqual(
			priceRangeViolation(
				{ ...CARD, vcpuHourMicroUsd: '999' },
				SETTINGS_DEFAULTS,
				CPU_MACHINE_GPUS
			),
			{
				resource: PricedResource.VCPU_HOUR,
				priceMicroUsd: MicroUsd.of(999n),
				minimumMicroUsd: MicroUsd.of(1_000n),
				maximumMicroUsd: MicroUsd.of(500_000n),
			}
		);
	});

	it('applies the disk limits to stopped disk too', () => {
		assert.equal(
			priceRangeViolation(
				{ ...CARD, stoppedDiskGibMonthMicroUsd: '1000001' },
				SETTINGS_DEFAULTS,
				CPU_MACHINE_GPUS
			)?.resource,
			PricedResource.STOPPED_DISK_GIB_MONTH
		);
	});

	it('bounds the GPU rate only on GPU machines', () => {
		assert.equal(
			priceRangeViolation(CARD, SETTINGS_DEFAULTS, CPU_MACHINE_GPUS),
			null
		);
		assert.equal(
			priceRangeViolation(CARD, SETTINGS_DEFAULTS, GPU_MACHINE_GPUS)?.resource,
			PricedResource.GPU_HOUR
		);
		assert.equal(
			priceRangeViolation(
				{ ...CARD, gpuHourMicroUsd: '20000001' },
				SETTINGS_DEFAULTS,
				GPU_MACHINE_GPUS
			)?.resource,
			PricedResource.GPU_HOUR
		);
	});

	it('follows the settings', () => {
		assert.equal(
			priceRangeViolation(
				CARD,
				{ ...SETTINGS_DEFAULTS, memoryGibHourPriceMaximumMicroUsd: 1_999 },
				CPU_MACHINE_GPUS
			)?.resource,
			PricedResource.MEMORY_GIB_HOUR
		);
	});
});
