<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
</script>

<script lang="ts">
import CircleCheck from '@lucide/svelte/icons/circle-check';
import type { AbuseCase } from '@snapflow/api-client';
import { renderSnippet } from '@tanstack/svelte-table';
import ResourceDetailsPanel from '#lib/components/resource/resource-details-panel.svelte';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import ResourceRowContextMenu from '#lib/components/resource/resource-row-context-menu.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import { renderResourceLabel } from '#lib/components/resource/table/resource-cell.ts';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import { resourceColumnHelper } from '#lib/components/resource/table/resource-table-model.ts';
import { timestampCell } from '#lib/components/resource/table/rich-cells.ts';
import TableFooter from '#lib/components/resource/table/table-footer.svelte';
import ChipModalConfirmTarget from '#lib/components/ui/chip-modal/chip-modal-confirm-target.svelte';
import IconButton from '#lib/components/ui/icon-button.svelte';
import AdminTableEmpty from '#lib/features/admin/components/shared/admin-table-empty.svelte';
import AdminToolbar from '#lib/features/admin/components/shared/admin-toolbar.svelte';
import {
	findingsSummary,
	isOpenCase,
	resolveAbuseCaseCopy,
} from '#lib/features/admin/lib/abuse-cases-list.ts';
import {
	NAME_COLUMN,
	STATUS_COLUMN,
	TIME_COLUMN,
	WIDE_COLUMN,
} from '#lib/features/admin/lib/admin-columns.ts';
import { adminTableError } from '#lib/features/admin/lib/admin-load-error.ts';
import { AbuseCasesList } from '#lib/features/admin/state/abuse-cases-list.svelte.ts';
import type { AdminViewSwitch } from '#lib/features/admin/state/admin-view-param.svelte.ts';
import { countLabel } from '#lib/utils/format.ts';
import AbuseCaseDetails from './abuse-case-details.svelte';

interface AbuseCasesViewProps {
	title: string;
	viewSwitch: AdminViewSwitch;
}

let { title, viewSwitch }: AbuseCasesViewProps = $props();

const list = new AbuseCasesList();

const column = resourceColumnHelper<AbuseCase>();
const columns = [
	column.accessor('sandboxId', {
		id: 'sandbox',
		header: 'Sandbox',
		meta: NAME_COLUMN,
		cell: ({ row }) =>
			renderResourceLabel({
				label: row.original.sandboxId,
				sublabel: row.original.organizationId,
			}),
	}),
	column.accessor('status', {
		id: 'status',
		header: 'Status',
		meta: STATUS_COLUMN,
		cell: ({ row }) => renderSnippet(statusCell, row.original),
	}),
	column.accessor(findingsSummary, {
		id: 'findings',
		header: 'Signals',
		meta: WIDE_COLUMN,
		cell: ({ getValue }) => renderResourceLabel({ label: getValue() }),
	}),
	column.accessor('firstSeenAt', {
		id: 'firstSeen',
		header: 'First seen',
		meta: { ...TIME_COLUMN, visibleFrom: 'xl' },
		cell: ({ row }) => timestampCell(row.original.firstSeenAt),
	}),
	column.accessor('lastSeenAt', {
		id: 'lastSeen',
		header: 'Last seen',
		meta: TIME_COLUMN,
		cell: ({ row }) => timestampCell(row.original.lastSeenAt),
	}),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions' },
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	}),
];
</script>

{#snippet statusCell(abuseCase: AbuseCase)}
	<ResourceStateBadge state={abuseCase.status} />
{/snippet}

{#snippet actionsCell(abuseCase: AbuseCase)}
	<ResourceRowActions
		label={`Abuse case ${abuseCase.id} actions`}
		actions={list.caseActions(abuseCase)}
	/>
{/snippet}

{#snippet emptyState()}
	<AdminTableEmpty
		message="No abuse cases"
		resource="cases"
		search={list.controls.search.value}
		filterCount={list.controls.filterCount}
		onClear={list.controls.clearSearchAndFilters}
	/>
{/snippet}

{#snippet panelActions()}
	{#if list.panel.row && isOpenCase(list.panel.row)}
		{const abuseCase = $derived(list.panel.row)}
		<IconButton
			variant="ghost"
			label="Resolve case"
			icon={CircleCheck}
			onclick={() => {
				list.resolving = abuseCase;
			}}
		/>
	{/if}
{/snippet}

{#snippet detailsPanel()}
	<ResourceDetailsPanel
		open={list.panel.row !== null}
		title="Abuse case"
		resourceId={list.panel.row?.id}
		resourceIdLabel="Copy case ID"
		onClose={list.panel.close}
		onPrevious={list.panel.previous}
		onNext={list.panel.next}
		actions={panelActions}
	>
		{#if list.panel.row}
			<AbuseCaseDetails abuseCase={list.panel.row} />
		{/if}
	</ResourceDetailsPanel>
{/snippet}

<AdminToolbar
	{title}
	{viewSwitch}
	controls={list.controls}
	searchPlaceholder="Search abuse cases"
/>
<ResourceRowContextMenu
	actionsFor={(rowId) => (rowId === null ? [] : list.caseRowActions(rowId))}
>
	<ResourceDataTable
		caption="Abuse cases"
		{columns}
		data={list.cases}
		getRowId={(abuseCase) => abuseCase.id}
		rowLabel={(abuseCase) => abuseCase.sandboxId}
		rowDimmed={(abuseCase) => !isOpenCase(abuseCase)}
		sort={list.controls.sort}
		sortConfig={list.controls.sortConfig}
		selectedRowId={list.panel.openId}
		isLoading={list.casesQuery.isLoading}
		isFetching={list.casesQuery.isRefetching}
		errorMessage={adminTableError(list.casesQuery.error, 'abuse cases')}
		empty={emptyState}
		onRetry={() => void list.casesQuery.refetch()}
		onRowClick={list.panel.open}
		rowContextMenu
		overlay={detailsPanel}
	/>
</ResourceRowContextMenu>
<TableFooter label={countLabel(list.cases.length, 'case')} />
<ChipModalConfirmTarget
	target={list.resolving}
	{...resolveAbuseCaseCopy(list.resolving)}
	pending={list.resolveMutation.isPending}
	onCancel={list.cancelResolve}
	onConfirm={list.confirmResolve}
/>
