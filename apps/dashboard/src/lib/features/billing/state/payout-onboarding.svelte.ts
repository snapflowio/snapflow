/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { PayoutAccount } from '@snapflow/api-client';
import { createQuery } from '@tanstack/svelte-query';
import {
	isPayoutAccountMissing,
	payoutAccountQueryOptions,
} from '#lib/api/billing/payouts.ts';
import {
	isPayoutAccountReady,
	payoutOnboardingSteps,
} from '#lib/features/billing/lib/payout-onboarding.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';

export class PayoutOnboarding {
	readonly #permission = getOrganizationPermission();
	readonly canRead = $derived(this.#permission.can({ payouts: ['read'] }));
	readonly canManage = $derived(this.#permission.can({ payouts: ['manage'] }));
	readonly query = createQuery(() => ({
		...payoutAccountQueryOptions(),
		enabled: this.canRead,
	}));
	readonly missing = $derived(
		this.query.isError && isPayoutAccountMissing(this.query.error)
	);
	readonly resolved = $derived(this.query.isSuccess || this.missing);
	readonly account = $derived<PayoutAccount | null>(this.query.data ?? null);
	readonly ready = $derived(isPayoutAccountReady(this.account));
	readonly steps = $derived(payoutOnboardingSteps(this.account));
}
