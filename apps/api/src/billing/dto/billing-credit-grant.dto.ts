/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsInt, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { ADMIN_CREDIT_GRANT_LIMITS } from '../constants/billing.constants';

const MINIMUM_GRANT_MICRO_USD = 1;
const NON_BLANK_PATTERN = /\S/;

@ApiSchema({ name: 'AdminGrantCredit' })
export class AdminGrantCreditDto {
	@ApiProperty({
		description: 'Credit to grant, in micro-USD',
		type: 'integer',
		minimum: MINIMUM_GRANT_MICRO_USD,
		maximum: ADMIN_CREDIT_GRANT_LIMITS.MAXIMUM_MICRO_USD,
	})
	@IsInt()
	@Min(MINIMUM_GRANT_MICRO_USD)
	@Max(ADMIN_CREDIT_GRANT_LIMITS.MAXIMUM_MICRO_USD)
	amountMicroUsd: number;

	@ApiProperty({
		description:
			'Why the credit is granted; recorded in the ledger and audit log',
		maxLength: ADMIN_CREDIT_GRANT_LIMITS.MAXIMUM_REASON_LENGTH,
	})
	@IsString()
	@Matches(NON_BLANK_PATTERN)
	@MaxLength(ADMIN_CREDIT_GRANT_LIMITS.MAXIMUM_REASON_LENGTH)
	reason: string;
}

@ApiSchema({ name: 'AdminCreditGrant' })
export class AdminCreditGrantDto {
	@ApiProperty({ format: 'uuid' }) grantId: string;
	@ApiProperty({ format: 'uuid' }) transactionId: string;
	@ApiProperty({ format: 'uuid' }) organizationId: string;
	@ApiProperty() amountMicroUsd: string;
	@ApiProperty() reason: string;
	@ApiProperty({ description: 'Customer credit balance after the grant' })
	creditBalanceMicroUsd: string;
	@ApiProperty({ type: String, format: 'date-time' }) grantedAt: Date;
}
