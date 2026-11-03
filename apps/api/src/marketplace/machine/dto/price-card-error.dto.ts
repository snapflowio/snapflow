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
