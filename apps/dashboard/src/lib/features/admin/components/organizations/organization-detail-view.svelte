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
const NOT_FOUND_STATUS = 404;
</script>

<script lang="ts">
import Building from '@lucide/svelte/icons/building-2';
import Users from '@lucide/svelte/icons/users';
import { createQuery } from '@tanstack/svelte-query';
import { adminOrganizationQueryOptions } from '#lib/api/admin/organizations.ts';
import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';
import ResourceChromeFallback from '#lib/components/resource/resource-chrome-fallback.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import AdminQueryFeedback from '#lib/features/admin/components/admin-query-feedback.svelte';
import AdminResourceNotFound from '#lib/features/admin/components/admin-resource-not-found.svelte';
import OrganizationCreditTab from '#lib/features/admin/components/organizations/organization-credit-tab.svelte';
import OrganizationDialogs from '#lib/features/admin/components/organizations/organization-dialogs.svelte';
import OrganizationLimitsTab from '#lib/features/admin/components/organizations/organization-limits-tab.svelte';
import OrganizationOverviewTab from '#lib/features/admin/components/organizations/organization-overview-tab.svelte';
import OrganizationQuotasTab from '#lib/features/admin/components/organizations/organization-quotas-tab.svelte';
import {
	type OrganizationDetailChrome,
	organizationDetailSearchSchema,
	organizationDetailTabs,
} from '#lib/features/admin/lib/organization-detail-tabs.ts';
import { adminOrganizationStatus } from '#lib/features/admin/lib/organization-status.ts';
import { AdminOrganizationActions } from '#lib/features/admin/state/admin-organization-actions.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
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

const notFound = $derived(
	organizationQuery.error instanceof SnapflowError &&
		organizationQuery.error.status === NOT_FOUND_STATUS
);
const listCrumb = $derived({
	label: 'Organizations',
	href: listHref,
	icon: Users,
});
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

{#if organizationQuery.data}
	{const organization = $derived(organizationQuery.data)}
	{const chrome: OrganizationDetailChrome = $derived({
		breadcrumbs: [listCrumb, { label: organization.name }],
		crumbActions: actions.rowActions(organization),
		tabs: organizationDetailTabs(page.url.pathname, search.current.tab),
		status: statusBadge,
	})}
	{#if search.current.tab === 'limits'}
		<OrganizationLimitsTab {chrome} organizationId={organization.id} />
	{:else if search.current.tab === 'quotas'}
		<OrganizationQuotasTab {chrome} organizationId={organization.id} />
	{:else if search.current.tab === 'credit'}
		<OrganizationCreditTab {chrome} {organization} />
	{:else}
		<OrganizationOverviewTab {chrome} {organization} />
	{/if}
{:else if organizationQuery.isPending}
	<ResourceChromeFallback breadcrumbs={[listCrumb]} />
{:else if notFound}
	<AdminResourceNotFound
		icon={Building}
		title="Organization not found"
		description="This organization may have been deleted or moved"
	/>
{:else}
	<AdminQueryFeedback
		errorMessage="Failed to load organization"
		loadingMessage="Loading organization..."
		query={organizationQuery}
	/>
{/if}
<OrganizationDialogs {actions} />
