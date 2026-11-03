/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsEnum, Matches } from 'class-validator';
import type { PaymentAccount } from '../entities/payment-account.entity';
import {
	PaymentAccountRequirementsStatus,
	PaymentAccountTaxInformationStatus,
	PaymentAccountTransfersStatus,
} from '../enums/payment-account-status.enum';
import { PayoutAccountType } from '../enums/payout-account-type.enum';
import { payoutAccountEligible } from '../utils/payout.util';

const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

@ApiSchema({ name: 'CreatePayoutAccount' })
export class CreatePayoutAccountDto {
	@ApiProperty({
		description: 'ISO 3166-1 alpha-2 country of the payout account',
		example: 'US',
	})
	@Matches(COUNTRY_CODE_PATTERN)
	country: string;

	@ApiProperty({
		enum: PayoutAccountType,
		enumName: 'PayoutAccountType',
		description:
			'Whether a person or a registered business receives the payouts',
	})
	@IsEnum(PayoutAccountType)
	type: PayoutAccountType;
}

@ApiSchema({ name: 'PayoutAccount' })
export class PayoutAccountDto {
	@ApiProperty() stripeAccountId: string;

	@ApiPropertyOptional({ type: String, nullable: true })
	country: string | null;

	@ApiProperty() customerConfigured: boolean;

	@ApiProperty() recipientRequested: boolean;

	@ApiProperty({
		enum: PaymentAccountTransfersStatus,
		enumName: 'PaymentAccountTransfersStatus',
	})
	transfersStatus: PaymentAccountTransfersStatus;

	@ApiProperty({
		enum: PaymentAccountRequirementsStatus,
		enumName: 'PaymentAccountRequirementsStatus',
	})
	requirementsStatus: PaymentAccountRequirementsStatus;

	@ApiProperty({
		enum: PaymentAccountTaxInformationStatus,
		enumName: 'PaymentAccountTaxInformationStatus',
	})
	taxInformationStatus: PaymentAccountTaxInformationStatus;

	@ApiPropertyOptional({ type: String, nullable: true })
	payoutsBlockedReason: string | null;

	@ApiProperty({
		description: 'Whether the weekly payout includes the account',
	})
	payoutsEnabled: boolean;

	@ApiProperty({ type: String, format: 'date-time' })
	createdAt: Date;

	static from(account: PaymentAccount): PayoutAccountDto {
		return {
			stripeAccountId: account.stripeAccountId,
			country: account.country,
			customerConfigured: account.customerConfigured,
			recipientRequested: account.recipientRequested,
			transfersStatus: account.transfersStatus,
			requirementsStatus: account.requirementsStatus,
			taxInformationStatus: account.taxInformationStatus,
			payoutsBlockedReason: account.payoutsBlockedReason,
			payoutsEnabled: payoutAccountEligible(account),
			createdAt: account.createdAt,
		};
	}
}

@ApiSchema({ name: 'PayoutAccountSession' })
export class PayoutAccountSessionDto {
	@ApiProperty({
		description: 'Client secret of the Connect embedded components session',
	})
	clientSecret: string;
}
