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
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { GpuType } from '../../../sandbox/machine/enums/gpu-type.enum';
import { MachineCategory } from '../enums/machine-category.enum';
import { MarketplaceErrorCode } from '../enums/marketplace-error-code.enum';
import type { PriceCardRates } from '../types/pricing.types';
import { machineCategory } from './machine-category.util';
import {
	evaluatePriceCard,
	nextPriceCardVersion,
	priceCardReferencePrice,
} from './price-card.util';
import {
	PRICE_CLASSES,
	priceClassCategory,
	priceClassOf,
} from './price-class.util';

const RATES: PriceCardRates = {
	vcpuHourMicroUsd: '10000',
	memoryGibHourMicroUsd: '2000',
	gpuHourMicroUsd: '0',
	diskGibMonthMicroUsd: '73000',
	stoppedDiskGibMonthMicroUsd: '36500',
	egressMicroUsdPerGiB: '20000',
};
const GENERAL_REFERENCE_MICRO_USD = MicroUsd.of(30_000n);
const EGRESS_CEILING_MICRO_USD = MicroUsd.of(100_000n);

describe('price card versions', () => {
	it('starts at one and increments the latest version', () => {
		assert.equal(nextPriceCardVersion(null), 1);
		assert.equal(nextPriceCardVersion(1), 2);
		assert.equal(nextPriceCardVersion(41), 42);
	});
});

describe('price card evaluation', () => {
	it('prices the class reference shape for one host hour', () => {
		assert.deepEqual(
			priceCardReferencePrice(RATES, MachineCategory.GENERAL),
			GENERAL_REFERENCE_MICRO_USD
		);
	});

	it('accepts a card at the floor', () => {
		assert.deepEqual(
			evaluatePriceCard(RATES, {
				category: MachineCategory.GENERAL,
				gpuCount: 0,
				floorMicroUsd: GENERAL_REFERENCE_MICRO_USD,
				egressCeilingMicroUsdPerGiB: EGRESS_CEILING_MICRO_USD,
			}),
			{ referencePriceMicroUsd: GENERAL_REFERENCE_MICRO_USD, error: null }
		);
	});

	it('accepts an egress price at the ceiling and free egress', () => {
		for (const egressMicroUsdPerGiB of ['100000', '0']) {
			assert.equal(
				evaluatePriceCard(
					{ ...RATES, egressMicroUsdPerGiB },
					{
						category: MachineCategory.GENERAL,
						gpuCount: 0,
						floorMicroUsd: GENERAL_REFERENCE_MICRO_USD,
						egressCeilingMicroUsdPerGiB: EGRESS_CEILING_MICRO_USD,
					}
				).error,
				null
			);
		}
	});

	it('rejects an egress price above the ceiling', () => {
		assert.equal(
			evaluatePriceCard(
				{ ...RATES, egressMicroUsdPerGiB: '100001' },
				{
					category: MachineCategory.GENERAL,
					gpuCount: 0,
					floorMicroUsd: GENERAL_REFERENCE_MICRO_USD,
					egressCeilingMicroUsdPerGiB: EGRESS_CEILING_MICRO_USD,
				}
			).error,
			MarketplaceErrorCode.PRICE_ABOVE_CEILING
		);
	});

	it('rejects a card below the floor', () => {
		assert.deepEqual(
			evaluatePriceCard(RATES, {
				category: MachineCategory.GENERAL,
				gpuCount: 0,
				floorMicroUsd: GENERAL_REFERENCE_MICRO_USD.add(MicroUsd.of(1n)),
				egressCeilingMicroUsdPerGiB: EGRESS_CEILING_MICRO_USD,
			}).error,
			MarketplaceErrorCode.PRICE_BELOW_FLOOR
		);
	});

	it('requires a positive GPU rate on GPU machines', () => {
		assert.deepEqual(
			evaluatePriceCard(RATES, {
				category: MachineCategory.GPU,
				gpuCount: 1,
				floorMicroUsd: MicroUsd.ZERO,
				egressCeilingMicroUsdPerGiB: EGRESS_CEILING_MICRO_USD,
			}).error,
			MarketplaceErrorCode.GPU_RATE_REQUIRED
		);
	});
});

describe('machine category and price class', () => {
	it('derives the category from measured capacity', () => {
		assert.equal(
			machineCategory({ vcpu: 4, memoryGib: 16, gpuCount: 0 }),
			MachineCategory.GENERAL
		);
		assert.equal(
			machineCategory({ vcpu: 4, memoryGib: 32, gpuCount: 0 }),
			MachineCategory.HIGH_MEMORY
		);
		assert.equal(
			machineCategory({ vcpu: 4, memoryGib: 64, gpuCount: 2 }),
			MachineCategory.GPU
		);
		assert.throws(() =>
			machineCategory({ vcpu: 0, memoryGib: 1, gpuCount: 0 })
		);
	});

	it('maps GPU machines to a per-model price class', () => {
		const gpuClass = priceClassOf({
			category: MachineCategory.GPU,
			gpuType: GpuType.H100,
		});

		assert.equal(gpuClass, 'gpu_h100');
		assert.ok(gpuClass && PRICE_CLASSES.includes(gpuClass));
		assert.equal(
			priceClassOf({ category: MachineCategory.GENERAL, gpuType: null }),
			MachineCategory.GENERAL
		);
		assert.equal(priceClassOf({ category: null, gpuType: null }), null);
		assert.equal(priceClassCategory('gpu_h100'), MachineCategory.GPU);
		assert.equal(priceClassCategory('gpu_unknown'), null);
	});
});
