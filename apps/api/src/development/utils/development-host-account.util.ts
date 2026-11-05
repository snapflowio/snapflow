/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	HOST_BUSINESS_PROFILE,
	STRIPE_CURRENCY,
	STRIPE_RESPONSIBLE_PARTY,
} from '../../payments/constants/stripe.constants';
import type { AccountFields } from '../../payments/services/payment-account.service';
import { DEVELOPMENT_HOST_ACCOUNT } from '../constants/development-machine-seed.constants';

// A platform-onboarded (dashboard none) test-mode recipient: every requirement is
// prefilled with Stripe's test values, so transfers turn active without onboarding.
export function developmentHostAccountFields(
	email: string,
	acceptedAt: Date
): AccountFields {
	return {
		dashboard: DEVELOPMENT_HOST_ACCOUNT.dashboard,
		identity: {
			country: DEVELOPMENT_HOST_ACCOUNT.country,
			entity_type: DEVELOPMENT_HOST_ACCOUNT.entityType,
			individual: {
				given_name: DEVELOPMENT_HOST_ACCOUNT.givenName,
				surname: DEVELOPMENT_HOST_ACCOUNT.surname,
				email,
				phone: DEVELOPMENT_HOST_ACCOUNT.phone,
				date_of_birth: DEVELOPMENT_HOST_ACCOUNT.dateOfBirth,
				address: DEVELOPMENT_HOST_ACCOUNT.address,
				id_numbers: [DEVELOPMENT_HOST_ACCOUNT.idNumber],
			},
			attestations: {
				terms_of_service: {
					account: {
						date: acceptedAt.toISOString(),
						ip: DEVELOPMENT_HOST_ACCOUNT.termsAcceptanceIp,
					},
				},
			},
		},
		configuration: {
			recipient: {
				capabilities: {
					stripe_balance: { stripe_transfers: { requested: true } },
				},
			},
		},
		defaults: {
			currency: STRIPE_CURRENCY,
			responsibilities: {
				fees_collector: STRIPE_RESPONSIBLE_PARTY,
				losses_collector: STRIPE_RESPONSIBLE_PARTY,
			},
			profile: {
				business_url: DEVELOPMENT_HOST_ACCOUNT.businessUrl,
				product_description: HOST_BUSINESS_PROFILE.product_description,
			},
		},
	};
}
