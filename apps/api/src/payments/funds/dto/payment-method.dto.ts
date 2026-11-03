/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import type { PaymentMethod } from '../entities/payment-method.entity';

@ApiSchema({ name: 'PaymentMethod' })
export class PaymentMethodDto {
	@ApiProperty({ format: 'uuid' })
	id: string;

	@ApiProperty({ example: 'visa' })
	brand: string;

	@ApiProperty({ example: '4242' })
	last4: string;

	@ApiProperty()
	expMonth: number;

	@ApiProperty()
	expYear: number;

	@ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
	firstChargedAt: Date | null;

	@ApiProperty({ type: String, format: 'date-time' })
	createdAt: Date;

	static from(method: PaymentMethod): PaymentMethodDto {
		return {
			id: method.id,
			brand: method.brand,
			last4: method.last4,
			expMonth: method.expMonth,
			expYear: method.expYear,
			firstChargedAt: method.firstChargedAt,
			createdAt: method.createdAt,
		};
	}
}
