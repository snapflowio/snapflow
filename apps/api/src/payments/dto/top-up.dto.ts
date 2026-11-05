/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import { CursorPageDto } from '../../common/dto/cursor-page.dto';
import type { TopUp } from '../entities/top-up.entity';
import { TopUpKind } from '../enums/top-up-kind.enum';
import { TopUpState } from '../enums/top-up-state.enum';

const MINIMUM_TOP_UP_CENTS = 1;

@ApiSchema({ name: 'CreateTopUp' })
export class CreateTopUpDto {
	@ApiProperty({
		description: 'Credit to buy in US cents, within the platform limits',
		minimum: MINIMUM_TOP_UP_CENTS,
	})
	@IsInt()
	@Min(MINIMUM_TOP_UP_CENTS)
	amountCents: number;
}

@ApiSchema({ name: 'UpdateTopUpAmount' })
export class UpdateTopUpAmountDto extends CreateTopUpDto {}

@ApiSchema({ name: 'TopUpSession' })
export class TopUpSessionDto {
	@ApiProperty({ format: 'uuid' })
	topUpId: string;

	@ApiProperty({
		description: 'Client secret of the embedded Checkout session',
	})
	checkoutClientSecret: string;
}

@ApiSchema({ name: 'TopUp' })
export class TopUpDto {
	@ApiProperty({ format: 'uuid' })
	id: string;

	@ApiProperty({ enum: TopUpKind, enumName: 'TopUpKind' })
	kind: TopUpKind;

	@ApiProperty({ enum: TopUpState, enumName: 'TopUpState' })
	state: TopUpState;

	@ApiProperty({ description: 'Credit bought in US cents' })
	amountCents: number;

	@ApiProperty({ description: 'Sales tax charged on top in US cents' })
	taxCents: number;

	@ApiPropertyOptional({ type: String, nullable: true })
	failureCode: string | null;

	@ApiPropertyOptional({
		description:
			'Client secret to confirm the payment on-session; present only while the top-up requires action',
	})
	paymentIntentClientSecret?: string;

	@ApiProperty({ type: String, format: 'date-time' })
	createdAt: Date;

	@ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
	succeededAt: Date | null;

	static from(topUp: TopUp, paymentIntentClientSecret?: string): TopUpDto {
		return {
			id: topUp.id,
			kind: topUp.kind,
			state: topUp.state,
			amountCents: topUp.amountCents,
			taxCents: topUp.taxCents,
			failureCode: topUp.failureCode,
			...(paymentIntentClientSecret ? { paymentIntentClientSecret } : {}),
			createdAt: topUp.createdAt,
			succeededAt: topUp.succeededAt,
		};
	}
}

@ApiSchema({ name: 'TopUpPage' })
export class TopUpPageDto extends CursorPageDto<TopUpDto> {
	@ApiProperty({ type: TopUpDto, isArray: true })
	declare items: TopUpDto[];
}
