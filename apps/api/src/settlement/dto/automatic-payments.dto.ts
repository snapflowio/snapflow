/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { SettlementErrorCode } from '../constants/payment-channel.constants';
import { UINT_STRING_API_PROPERTY } from '../constants/settlement.constants';
import { VoucherLimit } from '../enums/voucher-limit.enum';
import type {
	AdmissionVoucherLimit,
	AutomaticPaymentsGap,
} from '../types/automatic-payments.types';

@ApiSchema({ name: 'AutomaticPaymentsGap' })
export class AutomaticPaymentsGapDto {
	@ApiProperty({
		enum: VoucherLimit,
		enumName: 'VoucherLimit',
		description:
			'Why Snapflow cannot sign vouchers for the organization: the delegated signer is missing, revoked, stopping, expired, out of scope, or its hourly limit is below the running sandboxes',
	})
	reason: AdmissionVoucherLimit;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		nullable: true,
		description:
			'The hourly spending limit of the delegated signer, micro-USD; set when it is too low',
	})
	hourlyCapMicroUsd: string | null;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description: 'What the running sandboxes cost per hour now, micro-USD',
	})
	hourlySpendMicroUsd: string;

	@ApiProperty({
		type: String,
		format: 'date-time',
		nullable: true,
		description: 'When the delegated signer expired; set when it expired',
	})
	expiresAt: Date | null;

	static from(gap: AutomaticPaymentsGap): AutomaticPaymentsGapDto {
		return {
			reason: gap.limit,
			hourlyCapMicroUsd: gap.hourlyCapMicroUsd?.toString() ?? null,
			hourlySpendMicroUsd: gap.hourlySpendMicroUsd.toString(),
			expiresAt: gap.expiresAt,
		};
	}
}

@ApiSchema({ name: 'AutomaticPaymentsRequiredError' })
export class AutomaticPaymentsRequiredErrorDto extends AutomaticPaymentsGapDto {
	@ApiProperty({
		enum: [SettlementErrorCode.AUTOMATIC_PAYMENTS_REQUIRED],
		example: SettlementErrorCode.AUTOMATIC_PAYMENTS_REQUIRED,
	})
	code: typeof SettlementErrorCode.AUTOMATIC_PAYMENTS_REQUIRED;

	@ApiProperty() message: string;
}
