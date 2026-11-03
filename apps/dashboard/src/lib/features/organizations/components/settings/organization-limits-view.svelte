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
import {
	organizationLimitsQueryOptions,
	organizationUsageQueryOptions,
} from '#lib/api/organizations/limits.ts';
import FeedbackState from '#lib/components/feedback-state.svelte';
import SettingsPage from '#lib/components/settings/settings-page.svelte';
import OrganizationLimitsSection from '#lib/features/organizations/components/settings/organization-limits-section.svelte';
import OrganizationUsageSection from '#lib/features/organizations/components/settings/organization-usage-section.svelte';

const limitsQuery = createQuery(() => organizationLimitsQueryOptions());
const usageQuery = createQuery(() => organizationUsageQueryOptions());
</script>

<SettingsPage
	title="Limits"
	description="Resource quotas of this organization and how much of them is in use."
>
	{#if limitsQuery.data}
		<OrganizationLimitsSection limits={limitsQuery.data} />
		{#if usageQuery.data}
			<OrganizationUsageSection usage={usageQuery.data} />
		{:else if usageQuery.isError}
			<FeedbackState
				variant="inline"
				tone="error"
				retrying={usageQuery.isFetching}
				onRetry={() => void usageQuery.refetch()}
			>
				Failed to load usage
			</FeedbackState>
		{/if}
	{:else if limitsQuery.isError}
		<FeedbackState
			class="flex-1"
			tone="error"
			retrying={limitsQuery.isFetching}
			onRetry={() => void limitsQuery.refetch()}
		>
			Failed to load the organization limits
		</FeedbackState>
	{:else}
		<FeedbackState variant="inline">Loading limits...</FeedbackState>
	{/if}
</SettingsPage>
