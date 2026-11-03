/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { PayoutAccountType } from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import { billingConfigQueryOptions } from '#lib/api/billing/billing.ts';
import { createPayoutAccountMutationOptions } from '#lib/api/billing/payouts.ts';
import { payoutCountryOptions } from '#lib/features/billing/lib/payout-countries.ts';

export class PayoutAccountSetup {
	open = $state(false);
	country = $state('');
	type = $state<PayoutAccountType>(PayoutAccountType.Individual);
	readonly config = createQuery(() => ({
		...billingConfigQueryOptions(),
		enabled: this.open,
	}));
	readonly countries = $derived(
		payoutCountryOptions(this.config.data?.payoutCountries ?? [])
	);
	readonly #create = createMutation(() => createPayoutAccountMutationOptions());
	readonly pending = $derived(this.#create.isPending);
	readonly canSubmit = $derived(this.country !== '' && !this.pending);

	submit(): void {
		if (!this.canSubmit) return;
		this.#create.mutate(
			{ country: this.country, type: this.type },
			{
				onSuccess: () => {
					this.open = false;
				},
			}
		);
	}
}
