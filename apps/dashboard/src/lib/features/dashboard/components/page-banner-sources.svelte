<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { createMutation } from '@tanstack/svelte-query';
import { stopImpersonatingMutationOptions } from '#lib/api/admin/users.ts';
import OfflineBannerSource from '#lib/components/page-banner/offline-banner-source.svelte';
import {
	PageBannerKind,
	usePageBanner,
} from '#lib/components/page-banner/page-banner-state.svelte.ts';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import BillingBannerSource from '#lib/features/billing/components/billing-banner-source.svelte';
import PayoutsBannerSource from '#lib/features/earnings/components/payouts-banner-source.svelte';
import { Path } from '#lib/routing/paths.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

const FALLBACK_SUBJECT = 'another user';
const COUNTDOWN_SUFFIX = 'left';

const auth = getAuth();
const impersonating = $derived(Boolean(auth.session?.session.impersonatedBy));
const subject = $derived(
	auth.user?.name?.trim() || auth.user?.email || FALLBACK_SUBJECT
);
const endsAt = $derived(
	auth.session ? new Date(auth.session.session.expiresAt).getTime() : null
);

const stopImpersonating = createMutation(() => ({
	...stopImpersonatingMutationOptions(),
	onSuccess: async () => {
		await auth.refetch();
		await goto(resolve(Path.ADMIN_USERS), { replace: true });
	},
}));

usePageBanner(() =>
	impersonating
		? {
				kind: PageBannerKind.Impersonation,
				variant: 'default',
				message: `Impersonating ${subject}`,
				countdown:
					endsAt === null ? undefined : { endsAt, suffix: COUNTDOWN_SUFFIX },
				action: {
					label: 'Stop',
					loading: stopImpersonating.isPending,
					onSelect: () => stopImpersonating.mutate(),
				},
			}
		: null
);
</script>

<OfflineBannerSource />
<BillingBannerSource />
<PayoutsBannerSource />
