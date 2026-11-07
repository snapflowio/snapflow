/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { MarketplaceErrorCode } from '../enums/marketplace-error-code.enum';
import { PricedResource } from '../enums/priced-resource.enum';

@ApiSchema({ name: 'PriceBelowFloorError' })
export class PriceBelowFloorErrorDto {
	@ApiProperty({
		enum: MarketplaceErrorCode,
		enumName: 'MarketplaceErrorCode',
		example: MarketplaceErrorCode.PRICE_BELOW_FLOOR,
	})
	code: MarketplaceErrorCode.PRICE_BELOW_FLOOR;

	@ApiProperty() message: string;

	@ApiProperty() floorMicroUsd: string;

	@ApiProperty() referencePriceMicroUsd: string;
}

@ApiSchema({ name: 'PriceAboveCeilingError' })
export class PriceAboveCeilingErrorDto {
	@ApiProperty({
		enum: MarketplaceErrorCode,
		enumName: 'MarketplaceErrorCode',
		example: MarketplaceErrorCode.PRICE_ABOVE_CEILING,
	})
	code: MarketplaceErrorCode.PRICE_ABOVE_CEILING;

	@ApiProperty() message: string;

	@ApiProperty() egressCeilingMicroUsdPerGiB: string;

	@ApiProperty() egressMicroUsdPerGiB: string;
}

@ApiSchema({ name: 'PriceOutOfRangeError' })
export class PriceOutOfRangeErrorDto {
	@ApiProperty({
		enum: MarketplaceErrorCode,
		enumName: 'MarketplaceErrorCode',
		example: MarketplaceErrorCode.PRICE_OUT_OF_RANGE,
	})
	code: MarketplaceErrorCode.PRICE_OUT_OF_RANGE;

	@ApiProperty() message: string;

	@ApiProperty({
		enum: PricedResource,
		enumName: 'PricedResource',
		description: 'The resource whose price is out of range',
	})
	resource: PricedResource;

	@ApiProperty() priceMicroUsd: string;

	@ApiProperty({ description: 'Lowest allowed price, micro-USD' })
	minimumMicroUsd: string;

	@ApiProperty({ description: 'Highest allowed price, micro-USD' })
	maximumMicroUsd: string;
}
