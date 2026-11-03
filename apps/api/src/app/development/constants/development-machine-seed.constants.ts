/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { CreatePriceCardDto } from '../../../marketplace/machine/dto/price-card.dto';

export const DEVELOPMENT_MARKET_REFERENCE_PRICE = {
	bootstrapMedianMicroUsd: '40000',
} as const;

export const DEVELOPMENT_PRICE_CARD = {
	vcpuHourMicroUsd: '10000',
	memoryGibHourMicroUsd: '2500',
	gpuHourMicroUsd: '0',
	diskGibMonthMicroUsd: '100000',
	stoppedDiskGibMonthMicroUsd: '50000',
	egressMicroUsdPerGiB: '0',
} as const satisfies CreatePriceCardDto;

// Stripe test-mode values that verify an individual immediately; see
// https://docs.stripe.com/connect/testing. They only work with test keys.
export const DEVELOPMENT_HOST_ACCOUNT = {
	country: 'US',
	entityType: 'individual',
	dashboard: 'none',
	givenName: 'Development',
	surname: 'Host',
	phone: '+10000000000',
	dateOfBirth: { day: 1, month: 1, year: 1901 },
	address: {
		line1: 'address_full_match',
		city: 'San Francisco',
		state: 'CA',
		postal_code: '94111',
		country: 'US',
	},
	idNumber: { type: 'us_ssn_last_4', value: '0000' },
	termsAcceptanceIp: '127.0.0.1',
	businessUrl: 'https://snapflow.io',
	verifiedBankToken: 'btok_us_verified',
} as const;

export const DEVELOPMENT_TIER_REASON = 'development machine seed';
