<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const READ_ONLY_REASON = 'Needs the Admin or Owner role';
</script>

<script lang="ts">
import Gauge from '@lucide/svelte/icons/gauge';
import { createQuery } from '@tanstack/svelte-query';
import {
	organizationLimitsQueryOptions,
	organizationQuotaTierQueryOptions,
	organizationUsageQueryOptions,
	quotaIncreaseRequestsQueryOptions,
} from '#lib/api/organizations/limits.ts';
import FeedbackState from '#lib/components/feedback-state.svelte';
import type { HeaderAction } from '#lib/components/page/header-actions.ts';
import SettingsPage from '#lib/components/settings/settings-page.svelte';
import Skeleton, {
	SKELETON_SECTION_ROWS,
} from '#lib/components/ui/skeleton/skeleton.svelte';
import OrganizationLimitsSection from '#lib/features/organizations/components/settings/organization-limits-section.svelte';
import OrganizationTierSection from '#lib/features/organizations/components/settings/organization-tier-section.svelte';
import OrganizationUsageRows from '#lib/features/organizations/components/settings/organization-usage-rows.svelte';
import QuotaIncreaseRequestModal from '#lib/features/organizations/components/settings/quota-increase-request-modal.svelte';
import QuotaIncreaseRequestsSection from '#lib/features/organizations/components/settings/quota-increase-requests-section.svelte';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';

const permission = getOrganizationPermission();
const limitsQuery = createQuery(() => organizationLimitsQueryOptions());
const usageQuery = createQuery(() => organizationUsageQueryOptions());
const tierQuery = createQuery(() => organizationQuotaTierQueryOptions());
const requestsQuery = createQuery(() => quotaIncreaseRequestsQueryOptions());

let requestOpen = $state(false);

const canRequest = $derived(permission.can({ organization: ['update'] }));
const canAddFunds = $derived(permission.can({ billing: ['manage'] }));
const actions = $derived<HeaderAction[]>([
	{
		id: 'request-limits',
		kind: 'primary',
		label: 'Request higher limits',
		icon: Gauge,
		disabled: !canRequest,
		disabledReason: canRequest ? undefined : READ_ONLY_REASON,
		onSelect: () => {
			requestOpen = true;
		},
	},
]);
</script>

<SettingsPage title="Limits" {actions}>
	{#if tierQuery.data}
		<OrganizationTierSection standing={tierQuery.data} {canAddFunds} />
	{:else if tierQuery.isError}
		<FeedbackState
			variant="inline"
			tone="error"
			resource="the quota tier"
			error={tierQuery.error}
			retrying={tierQuery.isFetching}
			onRetry={() => void tierQuery.refetch()}
		/>
	{:else}
		<Skeleton class="h-32 rounded-2xl" />
	{/if}

	{#if usageQuery.data}
		<OrganizationUsageRows usage={usageQuery.data} />
	{:else if usageQuery.isError}
		<FeedbackState
			variant="inline"
			tone="error"
			resource="usage"
			error={usageQuery.error}
			retrying={usageQuery.isFetching}
			onRetry={() => void usageQuery.refetch()}
		/>
	{:else}
		<Skeleton class="h-14" repeat={SKELETON_SECTION_ROWS} fade />
	{/if}

	{#if limitsQuery.data}
		<OrganizationLimitsSection limits={limitsQuery.data} />
	{:else if limitsQuery.isError}
		<FeedbackState
			variant="inline"
			tone="error"
			resource="the organization limits"
			error={limitsQuery.error}
			retrying={limitsQuery.isFetching}
			onRetry={() => void limitsQuery.refetch()}
		/>
	{/if}

	{#if requestsQuery.data && requestsQuery.data.length > 0}
		<QuotaIncreaseRequestsSection requests={requestsQuery.data} />
	{:else if requestsQuery.isError}
		<FeedbackState
			variant="inline"
			tone="error"
			resource="limit requests"
			error={requestsQuery.error}
			retrying={requestsQuery.isFetching}
			onRetry={() => void requestsQuery.refetch()}
		/>
	{/if}
</SettingsPage>

{#if canRequest}
	<QuotaIncreaseRequestModal bind:open={requestOpen} />
{/if}
