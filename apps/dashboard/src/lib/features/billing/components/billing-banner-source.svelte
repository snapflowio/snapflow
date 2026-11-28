<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { createQuery } from '@tanstack/svelte-query';
import { billingOverviewQueryOptions } from '#lib/api/billing/billing.ts';
import { voucherDelegationQueryOptions } from '#lib/api/settlement/delegation.ts';
import {
	autoTopUpQueryOptions,
	escrowAccountQueryOptions,
} from '#lib/api/settlement/escrow.ts';
import {
	PageBannerKind,
	usePageBanner,
} from '#lib/components/page-banner/page-banner-state.svelte.ts';
import {
	BILLING_BANNER_FIX_LABEL,
	BILLING_FIX_LABELS,
	BillingFix,
	billingAttentionNotice,
	billingFixHref,
	billingOverviewNotice,
} from '#lib/features/billing/lib/billing-overview.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { isRoutePathActive } from '#lib/routing/router-path.ts';
import { resolve } from '$app/paths';
import { page } from '$app/state';

const permission = getOrganizationPermission();
const enabled = $derived(permission.can({ billing: ['read'] }));
const canManage = $derived(permission.can({ billing: ['manage'] }));
const passive = { refetchInterval: false } as const;
const overview = createQuery(() => ({
	...billingOverviewQueryOptions(),
	...passive,
	enabled,
}));
const delegation = createQuery(() => ({
	...voucherDelegationQueryOptions(),
	...passive,
	enabled,
}));
const autoTopUp = createQuery(() => ({
	...autoTopUpQueryOptions(),
	...passive,
	enabled,
}));
const account = createQuery(() => ({
	...escrowAccountQueryOptions(),
	...passive,
	enabled,
}));
const onBilling = $derived(
	isRoutePathActive(page.url.pathname, resolve(Path.BILLING))
);
const sources = $derived({
	overview: overview.data,
	delegation: delegation.data,
	autoTopUp: autoTopUp.data,
	account: account.data,
});
const notice = $derived.by(() => {
	if (!enabled) return null;
	return onBilling
		? billingOverviewNotice(sources)
		: billingAttentionNotice(sources);
});

const action = $derived.by(() => {
	if (!notice) return undefined;
	if (notice.fix === BillingFix.Support) {
		return {
			label: BILLING_FIX_LABELS[notice.fix],
			href: billingFixHref(notice.fix),
		};
	}
	return canManage
		? { label: BILLING_BANNER_FIX_LABEL, href: billingFixHref(notice.fix) }
		: undefined;
});

usePageBanner(() =>
	notice
		? {
				kind: PageBannerKind.BillingBlocked,
				variant: notice.tone === 'error' ? 'destructive' : 'default',
				message: notice.title,
				description: notice.description,
				action,
			}
		: null
);
</script>
