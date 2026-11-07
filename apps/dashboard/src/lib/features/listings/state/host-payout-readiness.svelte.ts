/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { PayoutReadiness } from '@snapflow/api-client';
import { createQuery } from '@tanstack/svelte-query';
import { paymentWalletsQueryOptions } from '#lib/api/settlement/wallets.ts';
import { payoutReadiness } from '#lib/features/listings/lib/payout-readiness.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';

export class HostPayoutReadiness {
	readonly #permission = getOrganizationPermission();
	readonly canRead = $derived(this.#permission.can({ payouts: ['read'] }));
	readonly canManage = $derived(this.#permission.can({ payouts: ['manage'] }));
	readonly #query = createQuery(() => ({
		...paymentWalletsQueryOptions(),
		enabled: this.canRead,
	}));
	readonly readiness: PayoutReadiness | undefined = $derived(
		this.#query.data ? payoutReadiness(this.#query.data) : undefined
	);
	readonly ready: boolean | undefined = $derived(
		this.readiness === undefined
			? undefined
			: this.readiness === PayoutReadiness.Ready
	);
}
