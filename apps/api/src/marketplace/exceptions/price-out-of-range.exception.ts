/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { UnprocessableEntityException } from '@nestjs/common';
import type { PriceOutOfRangeErrorDto } from '../dto/price-card-error.dto';
import { MarketplaceErrorCode } from '../enums/marketplace-error-code.enum';
import type { PriceRangeViolation } from '../utils/price-limit.util';

export class PriceOutOfRangeException extends UnprocessableEntityException {
	constructor(violation: PriceRangeViolation) {
		const body: PriceOutOfRangeErrorDto = {
			code: MarketplaceErrorCode.PRICE_OUT_OF_RANGE,
			message: `The ${violation.resource} price must be between $${violation.minimumMicroUsd.toUsd()} and $${violation.maximumMicroUsd.toUsd()}`,
			resource: violation.resource,
			priceMicroUsd: violation.priceMicroUsd.toString(),
			minimumMicroUsd: violation.minimumMicroUsd.toString(),
			maximumMicroUsd: violation.maximumMicroUsd.toString(),
		};
		super(body);
	}
}
