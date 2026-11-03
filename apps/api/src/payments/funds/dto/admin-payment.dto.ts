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
import type { PaymentAccount } from '../entities/payment-account.entity';
import type { PaymentDispute } from '../entities/payment-dispute.entity';
import { DisputeState } from '../enums/dispute-state.enum';
import { PayoutAccountDto } from './payout-account.dto';

@ApiSchema({ name: 'AdminPaymentDispute' })
export class AdminPaymentDisputeDto {
	@ApiProperty({ format: 'uuid' }) id: string;

	@ApiProperty() stripeDisputeId: string;

	@ApiProperty({ format: 'uuid' }) organizationId: string;

	@ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
	topUpId: string | null;

	@ApiProperty() amountCents: number;

	@ApiProperty({ description: 'Customer credit frozen against the dispute' })
	frozenMicroUsd: string;

	@ApiProperty({ enum: DisputeState, enumName: 'DisputeState' })
	state: DisputeState;

	@ApiProperty() reason: string;

	@ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
	evidenceDueBy: Date | null;

	@ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;

	@ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
	closedAt: Date | null;

	static from(dispute: PaymentDispute): AdminPaymentDisputeDto {
		return {
			id: dispute.id,
			stripeDisputeId: dispute.stripeDisputeId,
			organizationId: dispute.organizationId,
			topUpId: dispute.topUpId,
			amountCents: dispute.amountCents,
			frozenMicroUsd: dispute.frozenMicroUsd,
			state: dispute.state,
			reason: dispute.reason,
			evidenceDueBy: dispute.evidenceDueBy,
			createdAt: dispute.createdAt,
			closedAt: dispute.closedAt,
		};
	}
}

@ApiSchema({ name: 'AdminPaymentDisputePage' })
export class AdminPaymentDisputePageDto extends CursorPageDto<AdminPaymentDisputeDto> {
	@ApiProperty({ type: AdminPaymentDisputeDto, isArray: true })
	declare items: AdminPaymentDisputeDto[];
}

@ApiSchema({ name: 'ListAdminPaymentDisputesQuery' })
export class ListAdminPaymentDisputesQueryDto extends CursorPageQueryDto {
	@ApiPropertyOptional({ enum: DisputeState, enumName: 'DisputeState' })
	@IsOptional()
	@IsEnum(DisputeState)
	state?: DisputeState;
}

@ApiSchema({ name: 'AdminPaymentAccount' })
export class AdminPaymentAccountDto extends PayoutAccountDto {
	@ApiProperty({ format: 'uuid' }) organizationId: string;

	static from(account: PaymentAccount): AdminPaymentAccountDto {
		return {
			...PayoutAccountDto.from(account),
			organizationId: account.organizationId,
		};
	}
}
