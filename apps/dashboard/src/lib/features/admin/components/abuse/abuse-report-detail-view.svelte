<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const ABUSE_ROUTE_ID = '/(app)/(dashboard)/admin/abuse';
const NOT_YET = 'Not yet';
</script>

<script lang="ts">
import Copy from '@lucide/svelte/icons/copy';
import type { AbuseReportDetail } from '@snapflow/api-client';
import { createQuery } from '@tanstack/svelte-query';
import { adminAbuseReportQueryOptions } from '#lib/api/admin/abuse-reports.ts';
import SectionError from '#lib/components/app/section-error.svelte';
import ContextCard from '#lib/components/detail/context-card.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import PageColumn from '#lib/components/page/page-column.svelte';
import QueryFeedbackState from '#lib/components/query-feedback-state.svelte';
import Resource from '#lib/components/resource/resource.svelte';
import ResourceChromeFallback from '#lib/components/resource/resource-chrome-fallback.svelte';
import ResourceDetailShell from '#lib/components/resource/resource-detail-shell.svelte';
import ResourceHeader from '#lib/components/resource/resource-header.svelte';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import AdminMoreMenu from '#lib/features/admin/components/shared/admin-more-menu.svelte';
import {
	abuseReportDetailSearchSchema,
	abuseReportDetailTabs,
} from '#lib/features/admin/lib/abuse-report-detail-tabs.ts';
import { ABUSE_REPORT_CATEGORY_LABEL } from '#lib/features/admin/lib/abuse-reports-list.ts';
import { copyId } from '#lib/features/admin/lib/admin-list.ts';
import {
	adminLoadErrorMessage,
	isAdminNotFound,
} from '#lib/features/admin/lib/admin-load-error.ts';
import { AbuseReportActions } from '#lib/features/admin/state/abuse-report-actions.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { formatDateTime, formatOptionalDateTime } from '#lib/utils/format.ts';
import { afterNavigate } from '$app/navigation';
import { resolve } from '$app/paths';
import { page } from '$app/state';
import AbuseCaseActionModal from './abuse-case-action-modal.svelte';
import AbuseReportCaseTab from './abuse-report-case-tab.svelte';
import AbuseReportDecisionModal from './abuse-report-decision-modal.svelte';
import AbuseReportEvidence from './abuse-report-evidence.svelte';
import AbuseReportHistory from './abuse-report-history.svelte';
import AbuseReportOverview from './abuse-report-overview.svelte';

interface AbuseReportDetailViewProps {
	reportId: string;
}

let { reportId }: AbuseReportDetailViewProps = $props();

const search = new SearchParams(abuseReportDetailSearchSchema);
const reportQuery = createQuery(() => adminAbuseReportQueryOptions(reportId));
const actions = new AbuseReportActions(() => reportId);
let listHref = $state<string>(resolve(Path.ADMIN_ABUSE));

afterNavigate(({ from }) => {
	if (from?.route.id === ABUSE_ROUTE_ID) {
		listHref = `${from.url.pathname}${from.url.search}`;
	}
});

const listCrumb = $derived({ label: 'Abuse', href: listHref });

function moreActions(detail: AbuseReportDetail): ResourceRowAction[] {
	return [
		...actions.ladderActions(detail),
		{
			icon: Copy,
			label: 'Copy report ID',
			onSelect: () => copyId(detail.report.id),
			separated: true,
		},
	];
}
</script>

<svelte:head>
	<title>Abuse report · Snapflow</title>
</svelte:head>

{#snippet statusBadge()}
	{#if reportQuery.data}
		<ResourceStateBadge variant="pill" state={reportQuery.data.report.status} />
	{/if}
{/snippet}

{#snippet moreMenu()}
	{#if reportQuery.data}
		<AdminMoreMenu
			label="Abuse report actions"
			actions={moreActions(reportQuery.data)}
		/>
	{/if}
{/snippet}

{#snippet resourceRow(label: string, value: string | null, copyLabel: string)}
	<KeyValueRow {label} {value} mono copy={value} {copyLabel} />
{/snippet}

{#snippet contextView(detail: AbuseReportDetail)}
	<ContextCard title="Reported resources">
		<KeyValueList framed={false}>
			{@render resourceRow(
				'Sandbox',
				detail.report.sandboxId,
				'Copy sandbox ID'
			)}
			{@render resourceRow(
				'Organization',
				detail.report.organizationId,
				'Copy organization ID'
			)}
			{@render resourceRow(
				'Machine',
				detail.report.machineId,
				'Copy machine ID'
			)}
			{@render resourceRow('Case', detail.report.abuseCaseId, 'Copy case ID')}
		</KeyValueList>
	</ContextCard>
	<ContextCard title="Timeline">
		<KeyValueList framed={false}>
			<KeyValueRow
				label="Received"
				value={formatDateTime(detail.report.createdAt)}
			/>
			<KeyValueRow label="Due" value={formatDateTime(detail.report.dueAt)} />
			<KeyValueRow
				label="Acknowledged"
				value={formatOptionalDateTime(detail.report.acknowledgedAt, NOT_YET)}
			/>
			<KeyValueRow
				label="Decided"
				value={formatOptionalDateTime(detail.report.decidedAt, NOT_YET)}
			/>
		</KeyValueList>
	</ContextCard>
{/snippet}

{#if reportQuery.data}
	{const detail = $derived(reportQuery.data)}
	{#snippet aside()}
		{@render contextView(detail)}
	{/snippet}
	<ResourceDetailShell
		breadcrumbs={[
			listCrumb,
			{ label: ABUSE_REPORT_CATEGORY_LABEL[detail.report.category] },
		]}
		actions={actions.headerActions(detail)}
		status={statusBadge}
		trailing={moreMenu}
		{aside}
		asideTitle="Report details"
		pending={reportQuery.isRefetching}
		tabs={abuseReportDetailTabs(page.url.pathname, search.current.tab, detail)}
	>
		<PageColumn class="gap-y-12">
			{#if search.current.tab === 'case'}
				<AbuseReportCaseTab abuseCase={detail.abuseCase} />
			{:else if search.current.tab === 'evidence'}
				<AbuseReportEvidence evidence={detail.evidence} />
			{:else if search.current.tab === 'history'}
				<AbuseReportHistory actions={detail.actions} />
			{:else}
				<AbuseReportOverview report={detail.report} />
			{/if}
		</PageColumn>
	</ResourceDetailShell>
{:else if reportQuery.isPending}
	<ResourceChromeFallback breadcrumbs={[listCrumb]} />
{:else}
	<Resource>
		<ResourceHeader breadcrumbs={[listCrumb]} />
		{#if isAdminNotFound(reportQuery.error)}
			<SectionError
				title="Report not found"
				backHref={listHref}
				backLabel="Back to abuse"
			/>
		{:else}
			<QueryFeedbackState
				errorMessage={adminLoadErrorMessage(
					reportQuery.error,
					'this abuse report'
				)}
				loadingMessage="Loading abuse report"
				query={reportQuery}
			/>
		{/if}
	</Resource>
{/if}
<AbuseReportDecisionModal
	open={actions.deciding}
	pending={actions.decideMutation.isPending}
	onDecide={actions.decide}
	onClose={actions.closeDecision}
/>
<AbuseCaseActionModal
	pendingAction={actions.pendingAction}
	pending={actions.actionMutation.isPending}
	onApply={actions.applyAction}
	onClose={actions.closeAction}
/>
