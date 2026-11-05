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
import type { PriceAboveCeilingErrorDto } from '../dto/price-card-error.dto';
import { MarketplaceErrorCode } from '../enums/marketplace-error-code.enum';

export class PriceAboveCeilingException extends UnprocessableEntityException {
	constructor(ceilingMicroUsdPerGiB: MicroUsd, egressMicroUsdPerGiB: MicroUsd) {
		const body: PriceAboveCeilingErrorDto = {
			code: MarketplaceErrorCode.PRICE_ABOVE_CEILING,
			message: 'The egress price is above the market ceiling',
			egressCeilingMicroUsdPerGiB: ceilingMicroUsdPerGiB.toString(),
			egressMicroUsdPerGiB: egressMicroUsdPerGiB.toString(),
		};
		super(body);
	}
}
