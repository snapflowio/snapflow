<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const ORGANIZATIONS_ROUTE_ID = '/(app)/(dashboard)/admin/organizations';
</script>

<script lang="ts">
import type { AdminOrganization } from '@snapflow/api-client';
import { createQuery } from '@tanstack/svelte-query';
import { adminOrganizationQueryOptions } from '#lib/api/admin/organizations.ts';
import SectionError from '#lib/components/app/section-error.svelte';
import ContextCard from '#lib/components/detail/context-card.svelte';
import StatisticCard from '#lib/components/detail/statistic-card.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import QueryFeedbackState from '#lib/components/query-feedback-state.svelte';
import Resource from '#lib/components/resource/resource.svelte';
import ResourceChromeFallback from '#lib/components/resource/resource-chrome-fallback.svelte';
import ResourceHeader from '#lib/components/resource/resource-header.svelte';
import IdentityTile from '#lib/components/ui/avatar/identity-tile.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Money from '#lib/components/ui/money.svelte';
import OrganizationDialogs from '#lib/features/admin/components/organizations/organization-dialogs.svelte';
import OrganizationLimitsTab from '#lib/features/admin/components/organizations/organization-limits-tab.svelte';
import OrganizationOverviewTab from '#lib/features/admin/components/organizations/organization-overview-tab.svelte';
import OrganizationQuotasTab from '#lib/features/admin/components/organizations/organization-quotas-tab.svelte';
import AdminMoreMenu from '#lib/features/admin/components/shared/admin-more-menu.svelte';
import {
	adminLoadErrorMessage,
	isAdminNotFound,
} from '#lib/features/admin/lib/admin-load-error.ts';
import {
	type OrganizationDetailChrome,
	organizationDetailSearchSchema,
	organizationDetailTabs,
} from '#lib/features/admin/lib/organization-detail-tabs.ts';
import {
	adminOrganizationStatus,
	organizationTypeLabel,
} from '#lib/features/admin/lib/organization-status.ts';
import { AdminOrganizationActions } from '#lib/features/admin/state/admin-organization-actions.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { formatCount, formatDateTime } from '#lib/utils/format.ts';
import { afterNavigate } from '$app/navigation';
import { resolve } from '$app/paths';
import { page } from '$app/state';

interface OrganizationDetailViewProps {
	organizationId: string;
}

let { organizationId }: OrganizationDetailViewProps = $props();

const search = new SearchParams(organizationDetailSearchSchema);
const organizationQuery = createQuery(() =>
	adminOrganizationQueryOptions(organizationId)
);
const actions = new AdminOrganizationActions();
let listHref = $state<string>(resolve(Path.ADMIN_ORGANIZATIONS));

afterNavigate(({ from }) => {
	if (from?.route.id === ORGANIZATIONS_ROUTE_ID) {
		listHref = `${from.url.pathname}${from.url.search}`;
	}
});

const listCrumb = $derived({ label: 'Organizations', href: listHref });
</script>

<svelte:head>
	<title>
		{organizationQuery.data
			? `${organizationQuery.data.name} · Snapflow`
			: 'Organization · Snapflow'}
	</title>
</svelte:head>

{#snippet statusBadge()}
	{#if organizationQuery.data}
		{const status = $derived(adminOrganizationStatus(organizationQuery.data))}
		<Badge size="sm" variant={status.variant}>{status.label}</Badge>
	{/if}
{/snippet}

{#snippet moreMenu()}
	{#if organizationQuery.data}
		<AdminMoreMenu
			label={`${organizationQuery.data.name} actions`}
			actions={actions.rowActions(organizationQuery.data)}
		/>
	{/if}
{/snippet}

{#snippet contextView(organization: AdminOrganization)}
	<ContextCard>
		<div class="flex min-w-0 items-center gap-3">
			<IdentityTile name={organization.name} size="lg" class="size-12" />
			<div class="flex min-w-0 flex-col">
				<span class="truncate text-(--text-primary) text-base">
					{organization.name}
				</span>
				<span class="truncate text-(--text-muted) text-sm">
					{organization.slug}
				</span>
			</div>
		</div>
		<div class="flex gap-6">
			<StatisticCard label="Balance">
				<Money microUsd={organization.creditBalanceMicroUsd} />
			</StatisticCard>
			<StatisticCard
				label="Members"
				value={formatCount(organization.memberCount)}
			/>
		</div>
	</ContextCard>
	<ContextCard title="Details">
		<KeyValueList framed={false}>
			<KeyValueRow
				label="ID"
				value={organization.id}
				mono
				copy={organization.id}
				copyLabel="Copy organization ID"
			/>
			<KeyValueRow label="Type" value={organizationTypeLabel(organization)} />
			<KeyValueRow
				label="Created"
				value={formatDateTime(organization.createdAt)}
			/>
			<KeyValueRow
				label="Created by"
				value={organization.createdBy}
				mono
				copy={organization.createdBy ?? undefined}
				copyLabel="Copy creator ID"
			/>
			{#if organization.deletedAt}
				<KeyValueRow
					label="Deleted"
					value={formatDateTime(organization.deletedAt)}
				/>
			{/if}
		</KeyValueList>
	</ContextCard>
{/snippet}

{#if organizationQuery.data}
	{const organization = $derived(organizationQuery.data)}
	{#snippet aside()}
		{@render contextView(organization)}
	{/snippet}
	{const chrome: OrganizationDetailChrome = $derived({
		breadcrumbs: [listCrumb, { label: organization.name }],
		tabs: organizationDetailTabs(page.url.pathname, search.current.tab),
		status: statusBadge,
		trailing: moreMenu,
		aside,
		actions: [],
	})}
	{#if search.current.tab === 'limits'}
		<OrganizationLimitsTab {chrome} organizationId={organization.id} />
	{:else if search.current.tab === 'quotas'}
		<OrganizationQuotasTab {chrome} organizationId={organization.id} />
	{:else}
		<OrganizationOverviewTab {chrome} {organization} />
	{/if}
{:else if organizationQuery.isPending}
	<ResourceChromeFallback breadcrumbs={[listCrumb]} />
{:else}
	<Resource>
		<ResourceHeader breadcrumbs={[listCrumb]} />
		{#if isAdminNotFound(organizationQuery.error)}
			<SectionError
				title="Organization not found"
				backHref={listHref}
				backLabel="Back to organizations"
			/>
		{:else}
			<QueryFeedbackState
				errorMessage={adminLoadErrorMessage(
					organizationQuery.error,
					'this organization'
				)}
				loadingMessage="Loading organization"
				query={organizationQuery}
			/>
		{/if}
	</Resource>
{/if}
<OrganizationDialogs {actions} />
