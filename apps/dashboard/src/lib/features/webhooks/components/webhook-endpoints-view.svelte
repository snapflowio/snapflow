<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const ENDPOINT_DETAIL_ROUTE =
	'/(app)/(dashboard)/settings/webhooks/[endpointId]';
</script>

<script lang="ts">
import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
import Plus from '@lucide/svelte/icons/plus';
import Search from '@lucide/svelte/icons/search';
import Webhook from '@lucide/svelte/icons/webhook';
import EmptyState from '#lib/components/empty-state.svelte';
import FeedbackState from '#lib/components/feedback-state.svelte';
import SettingsPage from '#lib/components/settings/settings-page.svelte';
import SettingsResourceRow from '#lib/components/settings/settings-resource-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Skeleton, {
	SKELETON_SECTION_ROWS,
} from '#lib/components/ui/skeleton/skeleton.svelte';
import WebhookEndpointDialogs from '#lib/features/webhooks/components/webhook-endpoint-dialogs.svelte';
import {
	endpointAddress,
	endpointMeta,
	endpointStatusDisplay,
} from '#lib/features/webhooks/lib/webhook-display.ts';
import { WebhookEndpointsPage } from '#lib/features/webhooks/state/webhook-endpoints-page.svelte.ts';
import { resolve } from '$app/paths';

const page = new WebhookEndpointsPage();
</script>

<SettingsPage
	title="Webhooks"
	search={page.allEndpoints.length > 0
		? {
				value: page.search.value,
				onChange: (value) => (page.search.value = value),
				placeholder: 'Search endpoints',
			}
		: undefined}
	actions={page.headerActions}
>
	{#snippet trailing()}
		<Chip
			variant="ghost"
			href={page.docsHref}
			target="_blank"
			rel="noopener noreferrer"
			rightIcon={ArrowUpRight}
		>
			Documentation
		</Chip>
	{/snippet}
	{#if page.endpointsQuery.isError && page.endpointsQuery.data === undefined}
		<FeedbackState
			class="flex-1"
			tone="error"
			resource="webhook endpoints"
			error={page.endpointsQuery.error}
			retrying={page.endpointsQuery.isFetching}
			onRetry={() => void page.endpointsQuery.refetch()}
		/>
	{:else if page.endpointsQuery.isPending}
		<Skeleton class="h-18" repeat={SKELETON_SECTION_ROWS} fade />
	{:else if page.allEndpoints.length === 0}
		<EmptyState
			icon={Webhook}
			title="No webhook endpoints yet"
			description="Add an endpoint to receive events from Snapflow."
		>
			{#snippet actions()}
				<Chip
					variant="secondary"
					leftIcon={Plus}
					disabledReason={page.createDisabledReason}
					onclick={page.actions.openCreate}
				>
					Add endpoint
				</Chip>
			{/snippet}
		</EmptyState>
	{:else if page.endpoints.length === 0}
		<EmptyState icon={Search} title={`No results for “${page.query}”`}>
			{#snippet actions()}
				<Chip variant="secondary" onclick={() => (page.search.value = '')}>
					Clear search
				</Chip>
			{/snippet}
		</EmptyState>
	{:else}
		<SettingsSection title={`Endpoints (${page.endpoints.length})`}>
			{#each page.endpoints as endpoint (endpoint.id)}
				{const status = $derived(endpointStatusDisplay(endpoint))}
				{#snippet badge()}
					<Badge size="sm" variant={status.tone}>{status.label}</Badge>
				{/snippet}
				{#snippet meta()}
					<span class="flex min-w-0 flex-col gap-1">
						<span class="truncate font-mono text-xs">{endpoint.url}</span>
						<span class="truncate text-xs">{endpointMeta(endpoint)}</span>
					</span>
				{/snippet}
				<SettingsResourceRow
					title={endpoint.description || endpointAddress(endpoint).host}
					{meta}
					href={resolve(ENDPOINT_DETAIL_ROUTE, { endpointId: endpoint.id })}
					clickLabel={`Open ${endpoint.url}`}
					{badge}
				/>
			{/each}
		</SettingsSection>
	{/if}
</SettingsPage>

<WebhookEndpointDialogs actions={page.actions} />
