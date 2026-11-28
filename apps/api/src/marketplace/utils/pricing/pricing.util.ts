/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { feeBpsForMarkup, feeOf } from '@snapflow/contracts';
import { BASIS_POINTS_DENOMINATOR } from '../../../common/constants/money.constants';
import { MILLISECONDS_PER_HOUR } from '../../../common/constants/time.constants';
import {
	ceilDivide,
	decimalScale,
} from '../../../common/utils/fixed-point.util';
import { BasisPoints } from '../../../common/values/basis-points.value';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import type { ResourceShapeFields } from '../../../common/values/resource-shape.value';
import { USAGE_RESOURCE_SCALE } from '../../../usage/constants/usage-accounting.constants';
import { HOURS_PER_BILLING_MONTH } from '../../constants/pricing.constants';
import type {
	LinePrice,
	PriceCardTerms,
	PriceTerms,
	UsageQuantities,
} from '../../types/pricing.types';
import {
	scaledResource,
	sliceHourMicroUsd,
	wholeMachineShape,
} from './slice-pricing.util';

const RESOURCE_FACTOR = decimalScale(USAGE_RESOURCE_SCALE);
const ONE_HOUR_MILLIS = BigInt(MILLISECONDS_PER_HOUR);
const PRICE_DENOMINATOR =
	RESOURCE_FACTOR * ONE_HOUR_MILLIS * HOURS_PER_BILLING_MONTH;

export const ZERO_LINE_PRICE: Readonly<LinePrice> = {
	hostMicroUsd: MicroUsd.ZERO,
	markupMicroUsd: MicroUsd.ZERO,
	grossMicroUsd: MicroUsd.ZERO,
};

export function priceTerms(
	card: PriceCardTerms,
	shape: ResourceShapeFields,
	markupBasisPoints: number
): PriceTerms {
	return {
		hourMicroUsd: sliceHourMicroUsd(card, shape),
		diskGibMonthMicroUsd: BigInt(card.diskGibMonthMicroUsd),
		markupBasisPoints: BasisPoints.of(markupBasisPoints, 'Markup'),
	};
}

function interruptibleRate(rate: string, shareBasisPoints: number): string {
	return (
		(BigInt(rate) * BigInt(shareBasisPoints)) /
		BASIS_POINTS_DENOMINATOR
	).toString();
}

export function interruptibleCard(card: PriceCardTerms): PriceCardTerms {
	const share = card.interruptibleBasisPoints;
	return {
		...card,
		vcpuHourMicroUsd: interruptibleRate(card.vcpuHourMicroUsd, share),
		memoryGibHourMicroUsd: interruptibleRate(card.memoryGibHourMicroUsd, share),
		gpuHourMicroUsd: interruptibleRate(card.gpuHourMicroUsd, share),
	};
}

export function wholeMachinePriceTerms(
	card: PriceCardTerms,
	markupBasisPoints: number
): PriceTerms {
	return priceTerms(card, wholeMachineShape(card, 0), markupBasisPoints);
}

export const FREE_TERMS: Readonly<PriceTerms> = {
	hourMicroUsd: 0n,
	diskGibMonthMicroUsd: 0n,
	markupBasisPoints: BasisPoints.ZERO,
};

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
		runningMillis: RESOURCE_FACTOR * runningMillis,
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
		runningMillis: smaller(intended.runningMillis, attested.runningMillis),
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
	const numerator =
		terms.hourMicroUsd * quantities.runningMillis * HOURS_PER_BILLING_MONTH +
		terms.diskGibMonthMicroUsd *
			(quantities.runningDiskGibMillis + quantities.stoppedDiskGibMillis);
	return splitPrice(numerator, PRICE_DENOMINATOR, terms.markupBasisPoints);
}

function splitPrice(
	numerator: bigint,
	denominator: bigint,
	markup: BasisPoints
): LinePrice {
	const grossMicroUsd = MicroUsd.of(
		ceilDivide(
			numerator * (BASIS_POINTS_DENOMINATOR + markup.toBigInt()),
			denominator * BASIS_POINTS_DENOMINATOR
		)
	);
	const markupMicroUsd = MicroUsd.of(
		feeOf(grossMicroUsd.toBigInt(), feeBpsForMarkup(markup.toNumber()))
	);
	return {
		hostMicroUsd: grossMicroUsd.subtract(markupMicroUsd),
		markupMicroUsd,
		grossMicroUsd,
	};
}

export function markedUpHourly(
	hostHourMicroUsd: bigint,
	markup: BasisPoints
): MicroUsd {
	return splitPrice(hostHourMicroUsd, 1n, markup).grossMicroUsd;
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

function smaller(left: bigint, right: bigint): bigint {
	return left < right ? left : right;
}
