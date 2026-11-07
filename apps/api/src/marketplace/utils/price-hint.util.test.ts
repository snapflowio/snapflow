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
import { PricedResource } from '../enums/priced-resource.enum';
import type { SimilarListingPrices } from '../queries/price-hint.query';
import {
	monthlyEarningsEstimates,
	similarPriceRanges,
} from './price-hint.util';

const NO_GPUS = 0;
const ONE_GPU = 1;

const PRICES: SimilarListingPrices = {
	listings: 12,
	vcpu_hour_low: '8000',
	vcpu_hour_high: '20000',
	memory_gib_hour_low: '1000',
	memory_gib_hour_high: '3000',
	gpu_hour_low: '0',
	gpu_hour_high: '0',
	disk_gib_month_low: '50000',
	disk_gib_month_high: '90000',
	stopped_disk_gib_month_low: '20000',
	stopped_disk_gib_month_high: '40000',
	egress_gib_low: '0',
	egress_gib_high: '50000',
};

describe('similarPriceRanges', () => {
	it('lists every resource of a CPU machine but the GPU rate', () => {
		const ranges = similarPriceRanges(PRICES, NO_GPUS);
		assert.deepEqual(
			ranges.map((range) => range.resource),
			[
				PricedResource.VCPU_HOUR,
				PricedResource.MEMORY_GIB_HOUR,
				PricedResource.DISK_GIB_MONTH,
				PricedResource.STOPPED_DISK_GIB_MONTH,
				PricedResource.EGRESS_GIB,
			]
		);
		assert.deepEqual(ranges[0], {
			resource: PricedResource.VCPU_HOUR,
			lowMicroUsd: MicroUsd.of(8_000n),
			highMicroUsd: MicroUsd.of(20_000n),
		});
	});

	it('includes the GPU rate for a GPU machine', () => {
		assert.ok(
			similarPriceRanges(PRICES, ONE_GPU).some(
				(range) => range.resource === PricedResource.GPU_HOUR
			)
		);
	});

	it('is empty when no similar machine is listed', () => {
		const none: SimilarListingPrices = {
			listings: 0,
			vcpu_hour_low: null,
			vcpu_hour_high: null,
			memory_gib_hour_low: null,
			memory_gib_hour_high: null,
			gpu_hour_low: null,
			gpu_hour_high: null,
			disk_gib_month_low: null,
			disk_gib_month_high: null,
			stopped_disk_gib_month_low: null,
			stopped_disk_gib_month_high: null,
			egress_gib_low: null,
			egress_gib_high: null,
		};
		assert.deepEqual(similarPriceRanges(none, ONE_GPU), []);
	});
});

describe('monthlyEarningsEstimates', () => {
	it('prices the whole machine for a billing month at each utilization', () => {
		// 4 vCPUs at 10,000 and 16 GiB at 2,000 per hour is 72,000 an hour, or
		// 52,560,000 over 730 hours, plus 100 GiB of disk at 73,000 a month.
		const estimates = monthlyEarningsEstimates(
			{
				vcpuHourMicroUsd: '10000',
				memoryGibHourMicroUsd: '2000',
				gpuHourMicroUsd: '0',
				diskGibMonthMicroUsd: '73000',
				stoppedDiskGibMonthMicroUsd: '36500',
				egressMicroUsdPerGiB: '0',
			},
			{ cpu: 4, memoryGiB: 16, diskGiB: 100, gpu: 0 }
		);
		assert.deepEqual(
			estimates.map((estimate) => [
				estimate.utilization.toNumber(),
				estimate.monthlyMicroUsd.toString(),
			]),
			[
				[3_000, '17958000'],
				[5_000, '29930000'],
			]
		);
	});
});
