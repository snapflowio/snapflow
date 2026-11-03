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
import type { ResourceShapeFields } from '../../../common/values/resource-shape.value';
import { MachineCategory } from '../enums/machine-category.enum';
import type { PriceCardRates } from '../types/pricing.types';
import {
	egressPricePerGiB,
	median,
	minimumQuantities,
	priceFloor,
	priceTerms,
	priceTransfer,
	priceUsage,
	referencePrice,
	runningHourlyPrice,
	stoppedHourlyPrice,
	usageQuantities,
} from './pricing.util';

const PLATFORM_MARKUP_BASIS_POINTS = 2_500;
const SELF_USE_MARKUP_BASIS_POINTS = 0;
const ONE_HOUR_MILLIS = 3_600_000n;
const HALF_HOUR_MILLIS = 1_800_000n;

const card: PriceCardRates = {
	vcpuHourMicroUsd: '10000',
	memoryGibHourMicroUsd: '2000',
	gpuHourMicroUsd: '1000000',
	diskGibMonthMicroUsd: '73000',
	stoppedDiskGibMonthMicroUsd: '36500',
	egressMicroUsdPerGiB: '20000',
};

const shape: ResourceShapeFields = {
	cpu: 2,
	memoryGiB: 4,
	diskGiB: 20,
	gpu: 0,
};

describe('line pricing', () => {
	it('prices a running hour of the shape and adds the markup once', () => {
		const price = runningHourlyPrice(
			priceTerms(card, PLATFORM_MARKUP_BASIS_POINTS),
			shape
		);

		assert.deepEqual(price, {
			hostMicroUsd: MicroUsd.of(30_000n),
			markupMicroUsd: MicroUsd.of(7_500n),
			grossMicroUsd: MicroUsd.of(37_500n),
		});
	});

	it('keeps host plus markup equal to gross for every line', () => {
		const odd: PriceCardRates = {
			vcpuHourMicroUsd: '7919',
			memoryGibHourMicroUsd: '1301',
			gpuHourMicroUsd: '997',
			diskGibMonthMicroUsd: '104729',
			stoppedDiskGibMonthMicroUsd: '7907',
			egressMicroUsdPerGiB: '0',
		};
		for (const markup of [0, 1, 2_500, 3_333, 10_000]) {
			for (const millis of [0n, 1n, 999n, 61_001n, 86_399_999n]) {
				const terms = priceTerms(odd, markup);
				const price = priceUsage(
					terms,
					usageQuantities(
						{ cpu: 3, memoryGiB: 7, diskGiB: 13, gpu: 1 },
						millis,
						millis
					)
				);
				assert.deepEqual(
					price.hostMicroUsd.add(price.markupMicroUsd),
					price.grossMicroUsd
				);
				assert.ok(!price.markupMicroUsd.isNegative());
			}
		}
	});

	it('rounds the whole line once instead of each component', () => {
		const terms = priceTerms(
			{
				vcpuHourMicroUsd: '1',
				memoryGibHourMicroUsd: '1',
				gpuHourMicroUsd: '0',
				diskGibMonthMicroUsd: '1',
				stoppedDiskGibMonthMicroUsd: '1',
				egressMicroUsdPerGiB: '0',
			},
			PLATFORM_MARKUP_BASIS_POINTS
		);
		const price = priceUsage(
			terms,
			usageQuantities(
				{ cpu: 1, memoryGiB: 1, diskGiB: 0, gpu: 0 },
				HALF_HOUR_MILLIS,
				0n
			)
		);

		assert.deepEqual(price, {
			hostMicroUsd: MicroUsd.of(1n),
			markupMicroUsd: MicroUsd.of(1n),
			grossMicroUsd: MicroUsd.of(2n),
		});
	});

	it('floors the host share and ceils the gross by at most one micro-dollar', () => {
		const price = priceUsage(
			priceTerms(card, PLATFORM_MARKUP_BASIS_POINTS),
			usageQuantities(shape, 1n, 0n)
		);

		assert.deepEqual(price.hostMicroUsd, MicroUsd.ZERO);
		assert.deepEqual(price.grossMicroUsd, MicroUsd.of(1n));
	});

	it('charges no markup on self-use terms', () => {
		const price = runningHourlyPrice(
			priceTerms(card, SELF_USE_MARKUP_BASIS_POINTS),
			shape
		);

		assert.deepEqual(price.markupMicroUsd, MicroUsd.ZERO);
		assert.deepEqual(price.grossMicroUsd, price.hostMicroUsd);
	});

	it('bills a stopped sandbox only for its disk at the stopped rate', () => {
		const terms = priceTerms(card, PLATFORM_MARKUP_BASIS_POINTS);
		const stopped = stoppedHourlyPrice(terms, shape);
		const running = runningHourlyPrice(terms, shape);

		assert.deepEqual(stopped, {
			hostMicroUsd: MicroUsd.of(1_000n),
			markupMicroUsd: MicroUsd.of(250n),
			grossMicroUsd: MicroUsd.of(1_250n),
		});
		assert.ok(running.grossMicroUsd.greaterThan(stopped.grossMicroUsd));
	});

	it('meters stopped disk separately from running resources', () => {
		const quantities = usageQuantities(
			shape,
			ONE_HOUR_MILLIS,
			HALF_HOUR_MILLIS
		);

		assert.equal(quantities.vcpuMillis, 2n * 1_000_000n * ONE_HOUR_MILLIS);
		assert.equal(
			quantities.runningDiskGibMillis,
			20n * 1_000_000n * ONE_HOUR_MILLIS
		);
		assert.equal(
			quantities.stoppedDiskGibMillis,
			20n * 1_000_000n * HALF_HOUR_MILLIS
		);
		assert.equal(quantities.gpuMillis, 0n);
	});

	it('takes the smaller of the intended and attested quantities per resource', () => {
		const intended = usageQuantities(shape, ONE_HOUR_MILLIS, 0n);
		const attested = usageQuantities(shape, HALF_HOUR_MILLIS, ONE_HOUR_MILLIS);

		assert.deepEqual(minimumQuantities(intended, attested), {
			...attested,
			stoppedDiskGibMillis: 0n,
		});
	});

	it('rejects markups outside the basis-point range', () => {
		assert.throws(() => priceTerms(card, -1), /basis points/);
		assert.throws(() => priceTerms(card, 10_001), /basis points/);
		assert.throws(() => priceTerms(card, 0.5), /basis points/);
	});
});

describe('reference price and floor', () => {
	it('prices the class reference shape for one hour without markup', () => {
		const terms = priceTerms(card, PLATFORM_MARKUP_BASIS_POINTS);

		assert.deepEqual(
			referencePrice(terms, MachineCategory.GENERAL),
			MicroUsd.of(30_000n)
		);
		assert.deepEqual(
			referencePrice(terms, MachineCategory.HIGH_MEMORY),
			MicroUsd.of(54_000n)
		);
		assert.deepEqual(
			referencePrice(terms, MachineCategory.GPU),
			MicroUsd.of(1_228_000n)
		);
	});

	it('sets the floor as a share of the median, rounded up', () => {
		assert.deepEqual(
			priceFloor(MicroUsd.of(30_000n), 2_500),
			MicroUsd.of(7_500n)
		);
		assert.deepEqual(priceFloor(MicroUsd.of(1n), 2_500), MicroUsd.of(1n));
		assert.deepEqual(priceFloor(MicroUsd.of(30_000n), 0), MicroUsd.ZERO);
		assert.throws(
			() => priceFloor(MicroUsd.of(30_000n), 10_001),
			/basis points/
		);
	});

	it('takes the middle value or the floored mean of the middle pair', () => {
		assert.deepEqual(
			median([MicroUsd.of(3n), MicroUsd.of(1n), MicroUsd.of(2n)]),
			MicroUsd.of(2n)
		);
		assert.deepEqual(
			median([
				MicroUsd.of(10n),
				MicroUsd.of(1n),
				MicroUsd.of(3n),
				MicroUsd.of(2n),
			]),
			MicroUsd.of(2n)
		);
		assert.deepEqual(
			median([MicroUsd.of(4n), MicroUsd.of(6n)]),
			MicroUsd.of(5n)
		);
		assert.throws(() => median([]), /at least one value/);
	});
});

describe('transfer pricing', () => {
	const terms = priceTerms(card, PLATFORM_MARKUP_BASIS_POINTS);
	const GIBIBYTE = 1_073_741_824n;

	it('charges nothing for no bytes', () => {
		assert.deepEqual(priceTransfer(terms, 0n), {
			hostMicroUsd: MicroUsd.ZERO,
			markupMicroUsd: MicroUsd.ZERO,
			grossMicroUsd: MicroUsd.ZERO,
		});
	});

	it('floors the host share and rounds the gross up for one byte', () => {
		assert.deepEqual(priceTransfer(terms, 1n), {
			hostMicroUsd: MicroUsd.ZERO,
			markupMicroUsd: MicroUsd.of(1n),
			grossMicroUsd: MicroUsd.of(1n),
		});
	});

	it('rates whole and fractional gibibytes at the card rate plus markup', () => {
		assert.deepEqual(egressPricePerGiB(terms), {
			hostMicroUsd: MicroUsd.of(20_000n),
			markupMicroUsd: MicroUsd.of(5_000n),
			grossMicroUsd: MicroUsd.of(25_000n),
		});
		assert.deepEqual(priceTransfer(terms, GIBIBYTE + GIBIBYTE / 2n), {
			hostMicroUsd: MicroUsd.of(30_000n),
			markupMicroUsd: MicroUsd.of(7_500n),
			grossMicroUsd: MicroUsd.of(37_500n),
		});
	});

	it('never charges self-use or free egress', () => {
		const free = priceTerms(
			{ ...card, egressMicroUsdPerGiB: '0' },
			SELF_USE_MARKUP_BASIS_POINTS
		);
		assert.deepEqual(
			priceTransfer(free, GIBIBYTE * 1_000n).grossMicroUsd,
			MicroUsd.ZERO
		);
	});

	it('rejects negative byte counts', () => {
		assert.throws(() => priceTransfer(terms, -1n), /nonnegative/);
	});
});
