/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	BillingProfile,
	UpdateBillingProfile,
} from '@snapflow/api-client';
import * as z from 'zod';
import { countryName } from '#lib/utils/countries.ts';

export const BILLING_PROFILE_LIMITS = {
	LEGAL_NAME: 200,
	ADDRESS_LINE: 200,
	CITY: 100,
	REGION: 100,
	POSTAL_CODE: 32,
	TAX_ID: 64,
} as const;

const COUNTRY_CODE_LENGTH = 2;

function requiredText(label: string, maxLength: number) {
	return z
		.string()
		.trim()
		.min(1, `${label} is required`)
		.max(maxLength, `${label} must be ${maxLength} characters or fewer`);
}

function optionalText(label: string, maxLength: number) {
	return z
		.string()
		.trim()
		.max(maxLength, `${label} must be ${maxLength} characters or fewer`);
}

export const billingProfileSchema = z.object({
	legalName: requiredText('Legal name', BILLING_PROFILE_LIMITS.LEGAL_NAME),
	addressLine1: requiredText('Address', BILLING_PROFILE_LIMITS.ADDRESS_LINE),
	addressLine2: optionalText(
		'Address line 2',
		BILLING_PROFILE_LIMITS.ADDRESS_LINE
	),
	city: requiredText('City', BILLING_PROFILE_LIMITS.CITY),
	region: optionalText('State or region', BILLING_PROFILE_LIMITS.REGION),
	postalCode: optionalText('Postal code', BILLING_PROFILE_LIMITS.POSTAL_CODE),
	country: z.string().length(COUNTRY_CODE_LENGTH, 'Select a country'),
	taxId: optionalText('Tax ID', BILLING_PROFILE_LIMITS.TAX_ID),
});

export type BillingProfileValues = z.infer<typeof billingProfileSchema>;

export function billingProfileValues(
	profile: BillingProfile | null
): BillingProfileValues {
	return {
		legalName: profile?.legalName ?? '',
		addressLine1: profile?.addressLine1 ?? '',
		addressLine2: profile?.addressLine2 ?? '',
		city: profile?.city ?? '',
		region: profile?.region ?? '',
		postalCode: profile?.postalCode ?? '',
		country: profile?.country ?? '',
		taxId: profile?.taxId ?? '',
	};
}

function emptyAsNull(value: string): string | null {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export function billingProfileBody(
	values: BillingProfileValues
): UpdateBillingProfile {
	return {
		legalName: values.legalName.trim(),
		addressLine1: values.addressLine1.trim(),
		addressLine2: emptyAsNull(values.addressLine2),
		city: values.city.trim(),
		region: emptyAsNull(values.region),
		postalCode: emptyAsNull(values.postalCode),
		country: values.country,
		taxId: emptyAsNull(values.taxId),
	};
}

export function billingProfileLines(profile: BillingProfile): string[] {
	return [
		profile.addressLine1,
		profile.addressLine2,
		[profile.postalCode, profile.city, profile.region]
			.filter(Boolean)
			.join(' '),
		countryName(profile.country),
	].filter((line): line is string => Boolean(line));
}
