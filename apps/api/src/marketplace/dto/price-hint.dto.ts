/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { PRICE_HINT_PERCENTILES } from '../constants/pricing.constants';
import { PricedResource } from '../enums/priced-resource.enum';
import type { EarningsEstimate, PriceRange } from '../utils/price-hint.util';

@ApiSchema({ name: 'PriceRange' })
export class PriceRangeDto {
	@ApiProperty({ enum: PricedResource, enumName: 'PricedResource' })
	resource: PricedResource;

	@ApiProperty({
		description: `Host price at the ${PRICE_HINT_PERCENTILES.LOW} quantile of similar listings, micro-USD`,
	})
	lowMicroUsd: string;

	@ApiProperty({
		description: `Host price at the ${PRICE_HINT_PERCENTILES.HIGH} quantile of similar listings, micro-USD`,
	})
	highMicroUsd: string;

	static from(range: PriceRange): PriceRangeDto {
		return {
			resource: range.resource,
			lowMicroUsd: range.lowMicroUsd.toString(),
			highMicroUsd: range.highMicroUsd.toString(),
		};
	}
}

@ApiSchema({ name: 'EarningsEstimate' })
export class EarningsEstimateDto {
	@ApiProperty({
		description: 'Share of the month the whole machine is rented out',
	})
	utilizationBasisPoints: number;

	@ApiProperty({
		description: "Host earnings for the month at the machine's current price",
	})
	monthlyMicroUsd: string;

	static from(estimate: EarningsEstimate): EarningsEstimateDto {
		return {
			utilizationBasisPoints: estimate.utilization.toNumber(),
			monthlyMicroUsd: estimate.monthlyMicroUsd.toString(),
		};
	}
}

@ApiSchema({ name: 'MachinePriceHint' })
export class MachinePriceHintDto {
	@ApiProperty({ description: 'Category and GPU model the listings share' })
	priceClass: string;

	@ApiProperty({
		description:
			'Public listings of the price class, other than this machine, the ranges come from',
	})
	similarListingCount: number;

	@ApiProperty({
		type: PriceRangeDto,
		isArray: true,
		description: 'Empty when no similar machine is listed',
	})
	ranges: PriceRangeDto[];

	@ApiProperty({
		type: EarningsEstimateDto,
		isArray: true,
		description: 'Empty while the machine has no price card',
	})
	earnings: EarningsEstimateDto[];
}
