/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { UnprocessableEntityException } from '@nestjs/common';
import type { MicroUsd } from '../../common/values/micro-usd.value';
import type { PriceBelowFloorErrorDto } from '../dto/price-card-error.dto';
import { MarketplaceErrorCode } from '../enums/marketplace-error-code.enum';

export class PriceBelowFloorException extends UnprocessableEntityException {
	constructor(floorMicroUsd: MicroUsd, referencePriceMicroUsd: MicroUsd) {
		const body: PriceBelowFloorErrorDto = {
			code: MarketplaceErrorCode.PRICE_BELOW_FLOOR,
			message: 'The reference price is below the market floor',
			floorMicroUsd: floorMicroUsd.toString(),
			referencePriceMicroUsd: referencePriceMicroUsd.toString(),
		};
		super(body);
	}
}
