/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsUUID, Min } from 'class-validator';
import type { AutoTopUpPolicy } from '../entities/auto-top-up-policy.entity';

const MINIMUM_THRESHOLD_CENTS = 0;
const MINIMUM_AMOUNT_CENTS = 1;
const UNCONFIGURED_RESOURCE_VERSION = 0;

@ApiSchema({ name: 'UpdateAutoTopUp' })
export class UpdateAutoTopUpDto {
	@ApiProperty({ description: 'Whether automatic top-ups run' })
	@IsBoolean()
	enabled: boolean;

	@ApiProperty({
		description: 'Top up when spendable credit falls below this, in US cents',
		minimum: MINIMUM_THRESHOLD_CENTS,
	})
	@IsInt()
	@Min(MINIMUM_THRESHOLD_CENTS)
	thresholdCents: number;

	@ApiProperty({
		description: 'Credit bought per automatic top-up in US cents',
		minimum: MINIMUM_AMOUNT_CENTS,
	})
	@IsInt()
	@Min(MINIMUM_AMOUNT_CENTS)
	amountCents: number;

	@ApiProperty({ format: 'uuid', description: 'Saved card to charge' })
	@IsUUID()
	paymentMethodId: string;
}

@ApiSchema({ name: 'AutoTopUp' })
export class AutoTopUpDto {
	@ApiProperty() configured: boolean;

	@ApiProperty() enabled: boolean;

	@ApiProperty() thresholdCents: number;

	@ApiProperty() amountCents: number;

	@ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
	paymentMethodId: string | null;

	@ApiPropertyOptional({
		type: String,
		nullable: true,
		description: 'Why automatic top-ups paused until the next update',
	})
	suspendedReason: string | null;

	@ApiProperty() consecutiveFailures: number;

	@ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
	lastAttemptAt: Date | null;

	@ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
	consentedAt: Date | null;

	@ApiProperty({
		description: 'Version to send as If-Match; 0 before the first update',
	})
	resourceVersion: number;

	static from(policy: AutoTopUpPolicy): AutoTopUpDto {
		return {
			configured: true,
			enabled: policy.enabled,
			thresholdCents: policy.thresholdCents,
			amountCents: policy.amountCents,
			paymentMethodId: policy.paymentMethodId,
			suspendedReason: policy.suspendedReason,
			consecutiveFailures: policy.consecutiveFailures,
			lastAttemptAt: policy.lastAttemptAt,
			consentedAt: policy.consentedAt,
			resourceVersion: policy.version,
		};
	}

	static unconfigured(defaultAmountCents: number): AutoTopUpDto {
		return {
			configured: false,
			enabled: false,
			thresholdCents: MINIMUM_THRESHOLD_CENTS,
			amountCents: defaultAmountCents,
			paymentMethodId: null,
			suspendedReason: null,
			consecutiveFailures: 0,
			lastAttemptAt: null,
			consentedAt: null,
			resourceVersion: UNCONFIGURED_RESOURCE_VERSION,
		};
	}
}
