/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { Matches, MaxLength } from 'class-validator';
import {
	MARKETPLACE_MONEY_PRECISION,
	POSITIVE_MICRO_USD_PATTERN,
} from '../constants/marketplace.constants';
import { PriceFloorSource } from '../enums/price-floor-source.enum';
import type { EffectiveFloor } from '../types/machine.types';
import type { ReferenceMedians } from '../utils/price-floor.util';

@ApiSchema({ name: 'MarketReferencePrice' })
export class MarketReferencePriceDto {
	@ApiProperty() priceClass: string;
	@ApiProperty({ type: String, nullable: true })
	bootstrapMedianMicroUsd: string | null;
	@ApiProperty({ type: String, nullable: true })
	marketMedianMicroUsd: string | null;
	@ApiProperty() sampleCount: number;
	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	computedAt: Date | null;
	@ApiProperty({
		enum: PriceFloorSource,
		enumName: 'PriceFloorSource',
		nullable: true,
	})
	source: PriceFloorSource | null;
	@ApiProperty({ type: String, nullable: true })
	effectiveMedianMicroUsd: string | null;
	@ApiProperty({ type: String, nullable: true })
	floorMicroUsd: string | null;

	static from(
		reference: ReferenceMedians & { computedAt: Date | null },
		floor: EffectiveFloor | null
	): MarketReferencePriceDto {
		return {
			priceClass: reference.priceClass,
			bootstrapMedianMicroUsd: reference.bootstrapMedianMicroUsd,
			marketMedianMicroUsd: reference.marketMedianMicroUsd,
			sampleCount: reference.sampleCount,
			computedAt: reference.computedAt,
			source: floor?.source ?? null,
			effectiveMedianMicroUsd: floor?.medianMicroUsd.toString() ?? null,
			floorMicroUsd: floor?.floorMicroUsd.toString() ?? null,
		};
	}
}

@ApiSchema({ name: 'UpdateMarketReferencePrice' })
export class UpdateMarketReferencePriceDto {
	@ApiProperty({
		type: String,
		description: 'Median used until enough Verified hosts publish',
	})
	@MaxLength(MARKETPLACE_MONEY_PRECISION)
	@Matches(POSITIVE_MICRO_USD_PATTERN)
	bootstrapMedianMicroUsd: string;
}
