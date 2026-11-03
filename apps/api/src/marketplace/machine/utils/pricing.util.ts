/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	BASIS_POINTS_DENOMINATOR,
	RoundingMode,
} from '../../../common/constants/money.constants';
import { MILLISECONDS_PER_HOUR } from '../../../common/constants/time.constants';
import {
	ceilDivide,
	decimalScale,
	floorDivide,
	moneyToScaledInteger,
	parseFixed,
} from '../../../common/utils/fixed-point.util';
import { BasisPoints } from '../../../common/values/basis-points.value';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import type { ResourceShapeFields } from '../../../common/values/resource-shape.value';
import { USAGE_RESOURCE_SCALE } from '../../../usage/metering/constants/usage-accounting.constants';
import {
	BYTES_PER_GIBIBYTE,
	HOURS_PER_BILLING_MONTH,
	REFERENCE_SHAPES,
} from '../constants/pricing.constants';
import type { MachineCategory } from '../enums/machine-category.enum';
import type {
	LinePrice,
	PriceCardRates,
	PriceTerms,
	UsageQuantities,
} from '../types/pricing.types';

const RESOURCE_FACTOR = decimalScale(USAGE_RESOURCE_SCALE);
const ONE_HOUR_MILLIS = BigInt(MILLISECONDS_PER_HOUR);
const PRICE_DENOMINATOR =
	RESOURCE_FACTOR * ONE_HOUR_MILLIS * HOURS_PER_BILLING_MONTH;
const MEDIAN_PAIR_SIZE = 2;

export const ZERO_LINE_PRICE: Readonly<LinePrice> = {
	hostMicroUsd: MicroUsd.ZERO,
	markupMicroUsd: MicroUsd.ZERO,
	grossMicroUsd: MicroUsd.ZERO,
};

export function priceTerms(
	card: PriceCardRates,
	markupBasisPoints: number
): PriceTerms {
	return {
		vcpuHourMicroUsd: moneyToScaledInteger(card.vcpuHourMicroUsd),
		memoryGibHourMicroUsd: moneyToScaledInteger(card.memoryGibHourMicroUsd),
		gpuHourMicroUsd: moneyToScaledInteger(card.gpuHourMicroUsd),
		diskGibMonthMicroUsd: moneyToScaledInteger(card.diskGibMonthMicroUsd),
		stoppedDiskGibMonthMicroUsd: moneyToScaledInteger(
			card.stoppedDiskGibMonthMicroUsd
		),
		egressMicroUsdPerGiB: moneyToScaledInteger(card.egressMicroUsdPerGiB),
		markupBasisPoints: BasisPoints.of(markupBasisPoints, 'Markup'),
	};
}

export function usageQuantities(
	shape: ResourceShapeFields,
	runningMillis: bigint,
	stoppedMillis: bigint
): UsageQuantities {
	if (runningMillis < 0n || stoppedMillis < 0n) {
		throw new Error('Usage durations must be nonnegative');
	}
	const disk = scaledResource(shape.diskGiB, 'disk');
	return {
		vcpuMillis: scaledResource(shape.cpu, 'CPU') * runningMillis,
		memoryGibMillis: scaledResource(shape.memoryGiB, 'memory') * runningMillis,
		gpuMillis: scaledResource(shape.gpu, 'GPU') * runningMillis,
		runningDiskGibMillis: disk * runningMillis,
		stoppedDiskGibMillis: disk * stoppedMillis,
	};
}

export function minimumQuantities(
	intended: UsageQuantities,
	attested: UsageQuantities
): UsageQuantities {
	return {
		vcpuMillis: smaller(intended.vcpuMillis, attested.vcpuMillis),
		memoryGibMillis: smaller(
			intended.memoryGibMillis,
			attested.memoryGibMillis
		),
		gpuMillis: smaller(intended.gpuMillis, attested.gpuMillis),
		runningDiskGibMillis: smaller(
			intended.runningDiskGibMillis,
			attested.runningDiskGibMillis
		),
		stoppedDiskGibMillis: smaller(
			intended.stoppedDiskGibMillis,
			attested.stoppedDiskGibMillis
		),
	};
}

export function priceUsage(
	terms: PriceTerms,
	quantities: UsageQuantities
): LinePrice {
	const hourly =
		terms.vcpuHourMicroUsd * quantities.vcpuMillis +
		terms.memoryGibHourMicroUsd * quantities.memoryGibMillis +
		terms.gpuHourMicroUsd * quantities.gpuMillis;
	const numerator =
		hourly * HOURS_PER_BILLING_MONTH +
		terms.diskGibMonthMicroUsd * quantities.runningDiskGibMillis +
		terms.stoppedDiskGibMonthMicroUsd * quantities.stoppedDiskGibMillis;
	return splitPrice(numerator, PRICE_DENOMINATOR, terms.markupBasisPoints);
}

export function priceTransfer(
	terms: Pick<PriceTerms, 'egressMicroUsdPerGiB' | 'markupBasisPoints'>,
	bytes: bigint
): LinePrice {
	if (bytes < 0n) throw new Error('Transferred bytes must be nonnegative');
	return splitPrice(
		terms.egressMicroUsdPerGiB * bytes,
		BYTES_PER_GIBIBYTE,
		terms.markupBasisPoints
	);
}

export function egressPricePerGiB(
	terms: Pick<PriceTerms, 'egressMicroUsdPerGiB' | 'markupBasisPoints'>
): LinePrice {
	return priceTransfer(terms, BYTES_PER_GIBIBYTE);
}

function splitPrice(
	numerator: bigint,
	denominator: bigint,
	markup: BasisPoints
): LinePrice {
	const hostMicroUsd = MicroUsd.of(floorDivide(numerator, denominator));
	const grossMicroUsd = MicroUsd.of(
		ceilDivide(
			numerator * (BASIS_POINTS_DENOMINATOR + markup.toBigInt()),
			denominator * BASIS_POINTS_DENOMINATOR
		)
	);
	return {
		hostMicroUsd,
		markupMicroUsd: grossMicroUsd.subtract(hostMicroUsd),
		grossMicroUsd,
	};
}

export function runningHourlyPrice(
	terms: PriceTerms,
	shape: ResourceShapeFields
): LinePrice {
	return priceUsage(terms, usageQuantities(shape, ONE_HOUR_MILLIS, 0n));
}

export function stoppedHourlyPrice(
	terms: PriceTerms,
	shape: ResourceShapeFields
): LinePrice {
	return priceUsage(terms, usageQuantities(shape, 0n, ONE_HOUR_MILLIS));
}

export function referencePrice(
	terms: PriceTerms,
	category: MachineCategory
): MicroUsd {
	return runningHourlyPrice(
		{ ...terms, markupBasisPoints: BasisPoints.ZERO },
		REFERENCE_SHAPES[category]
	).hostMicroUsd;
}

export function priceFloor(
	medianMicroUsd: MicroUsd,
	floorBasisPoints: number
): MicroUsd {
	return BasisPoints.of(floorBasisPoints, 'Price floor').applyTo(
		medianMicroUsd,
		RoundingMode.CEIL
	);
}

export function median(values: readonly MicroUsd[]): MicroUsd {
	if (values.length === 0) throw new Error('A median needs at least one value');
	const sorted = [...values].sort((left, right) => left.compare(right));
	const middle = Math.floor(sorted.length / MEDIAN_PAIR_SIZE);
	if (sorted.length % MEDIAN_PAIR_SIZE !== 0) return sorted[middle];
	return sorted[middle - 1]
		.add(sorted[middle])
		.divideFloor(BigInt(MEDIAN_PAIR_SIZE));
}

function scaledResource(value: number, name: string): bigint {
	if (!Number.isFinite(value) || value < 0) {
		throw new Error(`${name} must be a nonnegative finite number`);
	}
	return parseFixed(
		value.toFixed(USAGE_RESOURCE_SCALE),
		USAGE_RESOURCE_SCALE,
		name
	);
}

function smaller(left: bigint, right: bigint): bigint {
	return left < right ? left : right;
}
