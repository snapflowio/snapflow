/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { AutomaticPaymentsRequiredErrorDto } from '../../settlement/dto/automatic-payments.dto';
import { BillingRestrictedErrorDto } from '../dto/sandbox-placement-error.dto';

export function ApiPaymentRequiredResponse(): MethodDecorator & ClassDecorator {
	return applyDecorators(
		ApiExtraModels(
			BillingRestrictedErrorDto,
			AutomaticPaymentsRequiredErrorDto
		),
		ApiResponse({
			status: HttpStatus.PAYMENT_REQUIRED,
			description:
				'The start would exceed what the organization or the API key may spend, or automatic payments cannot pay for the sandbox',
			schema: {
				oneOf: [
					{ $ref: getSchemaPath(BillingRestrictedErrorDto) },
					{ $ref: getSchemaPath(AutomaticPaymentsRequiredErrorDto) },
				],
			},
		})
	);
}
