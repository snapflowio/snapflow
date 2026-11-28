/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import {
	IsISO31661Alpha2,
	IsOptional,
	IsString,
	MaxLength,
	MinLength,
	ValidateIf,
} from 'class-validator';
import { IsSafeDisplayString } from '../../common/validators/is-safe-string.validator';
import { BILLING_PROFILE_LIMITS } from '../constants/billing-receipt.constants';
import type { BillingProfile } from '../entities/billing-profile.entity';

const MINIMUM_TEXT_LENGTH = 1;

function RequiredText(maxLength: number, description: string) {
	return applyDecorators(
		ApiProperty({ maxLength, description }),
		IsString(),
		IsSafeDisplayString(),
		MinLength(MINIMUM_TEXT_LENGTH),
		MaxLength(maxLength)
	);
}

function OptionalText(maxLength: number, description: string) {
	return applyDecorators(
		ApiPropertyOptional({
			type: String,
			nullable: true,
			maxLength,
			description: `${description}; null or omitted clears it`,
		}),
		IsOptional(),
		ValidateIf((_input, value) => value !== null),
		IsString(),
		IsSafeDisplayString(),
		MinLength(MINIMUM_TEXT_LENGTH),
		MaxLength(maxLength)
	);
}

@ApiSchema({ name: 'UpdateBillingProfile' })
export class UpdateBillingProfileDto {
	@RequiredText(
		BILLING_PROFILE_LIMITS.LEGAL_NAME,
		'Legal or company name printed on receipts'
	)
	legalName: string;

	@RequiredText(BILLING_PROFILE_LIMITS.ADDRESS_LINE, 'Street address')
	addressLine1: string;

	@OptionalText(
		BILLING_PROFILE_LIMITS.ADDRESS_LINE,
		'Apartment, suite or building'
	)
	addressLine2?: string | null;

	@RequiredText(BILLING_PROFILE_LIMITS.CITY, 'City or town')
	city: string;

	@OptionalText(BILLING_PROFILE_LIMITS.REGION, 'State, province or region')
	region?: string | null;

	@OptionalText(BILLING_PROFILE_LIMITS.POSTAL_CODE, 'Postal or ZIP code')
	postalCode?: string | null;

	@ApiProperty({
		description: 'ISO 3166-1 alpha-2 country code',
		example: 'US',
	})
	@IsISO31661Alpha2()
	country: string;

	@OptionalText(
		BILLING_PROFILE_LIMITS.TAX_ID,
		'Tax or VAT registration number printed on receipts'
	)
	taxId?: string | null;
}

@ApiSchema({ name: 'BillingProfile' })
export class BillingProfileDto {
	@ApiProperty() legalName: string;
	@ApiProperty() addressLine1: string;
	@ApiProperty({ type: String, nullable: true }) addressLine2: string | null;
	@ApiProperty() city: string;
	@ApiProperty({ type: String, nullable: true }) region: string | null;
	@ApiProperty({ type: String, nullable: true }) postalCode: string | null;
	@ApiProperty({ description: 'ISO 3166-1 alpha-2 country code' })
	country: string;
	@ApiProperty({ type: String, nullable: true }) taxId: string | null;
	@ApiProperty({ type: String, format: 'date-time' }) updatedAt: Date;

	static from(profile: BillingProfile): BillingProfileDto {
		return {
			legalName: profile.legalName,
			addressLine1: profile.addressLine1,
			addressLine2: profile.addressLine2,
			city: profile.city,
			region: profile.region,
			postalCode: profile.postalCode,
			country: profile.country,
			taxId: profile.taxId,
			updatedAt: profile.updatedAt,
		};
	}
}
