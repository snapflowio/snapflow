/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import {
	CursorPageDto,
	CursorPageQueryDto,
} from '../../../common/dto/cursor-page.dto';
import type { Payout } from '../entities/payout.entity';
import { PayoutState } from '../enums/payout-state.enum';

@ApiSchema({ name: 'Payout' })
export class PayoutDto {
	@ApiProperty({ format: 'uuid' }) id: string;

	@ApiProperty({ format: 'uuid' }) organizationId: string;

	@ApiProperty({ format: 'uuid' }) batchId: string;

	@ApiProperty() amountCents: number;

	@ApiProperty() amountMicroUsd: string;

	@ApiProperty({ enum: PayoutState, enumName: 'PayoutState' })
	state: PayoutState;

	@ApiPropertyOptional({ type: String, nullable: true })
	stripeTransferId: string | null;

	@ApiPropertyOptional({ type: String, nullable: true })
	failureReason: string | null;

	@ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;

	@ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
	transferredAt: Date | null;

	static from(payout: Payout): PayoutDto {
		return {
			id: payout.id,
			organizationId: payout.organizationId,
			batchId: payout.batchId,
			amountCents: payout.amountCents,
			amountMicroUsd: payout.amountMicroUsd,
			state: payout.state,
			stripeTransferId: payout.stripeTransferId,
			failureReason: payout.failureReason,
			createdAt: payout.createdAt,
			transferredAt: payout.transferredAt,
		};
	}
}

@ApiSchema({ name: 'PayoutPage' })
export class PayoutPageDto extends CursorPageDto<PayoutDto> {
	@ApiProperty({ type: PayoutDto, isArray: true })
	declare items: PayoutDto[];
}

@ApiSchema({ name: 'ListPayoutsQuery' })
export class ListPayoutsQueryDto extends CursorPageQueryDto {
	@ApiPropertyOptional({ enum: PayoutState, enumName: 'PayoutState' })
	@IsOptional()
	@IsEnum(PayoutState)
	state?: PayoutState;
}
