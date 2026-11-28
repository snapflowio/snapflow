/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { QuotaTierDto } from './quota-tier.dto';

@ApiSchema({ name: 'OrganizationQuotaTier' })
export class OrganizationQuotaTierDto {
	@ApiProperty({
		description:
			'Tier the organization holds; 0 until an owner verifies their email address',
	})
	tier: number;

	@ApiProperty({
		type: Number,
		nullable: true,
		description: 'Tier above the current one; null at the highest tier',
	})
	nextTier: number | null;

	@ApiProperty({
		description: 'An owner of the organization has a verified email address',
	})
	verifiedEmail: boolean;

	@ApiProperty({
		description:
			'Confirmed USDC deposits of the organization in total, micro-USD, as a decimal string',
	})
	lifetimeDepositMicroUsd: string;

	@ApiProperty({
		description:
			'Confirmed USDC deposits of the organization in the trailing window, micro-USD, as a decimal string',
	})
	trailingDepositMicroUsd: string;

	@ApiProperty({ description: 'Days the trailing deposit window covers' })
	trailingWindowDays: number;

	@ApiProperty({ type: [QuotaTierDto] })
	tiers: QuotaTierDto[];
}
