<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import {
	type SandboxListItem,
	SandboxListSortField,
	SandboxState,
} from '@snapflow/api-client';
import type {
	SandboxBulkAction,
	SandboxLifecycleAction,
} from '#lib/api/sandboxes/sandboxes.ts';
import type { ResourceSortConfig } from '#lib/components/resource/resource-options.ts';
import type { ResourceActionPermissions } from '#lib/features/organizations/lib/organization-permission.ts';

interface SandboxesTableProps {
	sandboxes: readonly SandboxListItem[];
	selectedRowIds?: string[];
	sortConfig?: ResourceSortConfig;
	isLoading: boolean;
	isFetching: boolean;
	isError: boolean;
	onRetry: () => void;
	permissions: ResourceActionPermissions;
	empty: Snippet;
	onCreate: () => void;
	onAction: (
		action: SandboxLifecycleAction,
		targets: readonly SandboxListItem[]
	) => void;
	onDelete: (targets: readonly SandboxListItem[]) => void;
	onOpenTerminal: (sandbox: SandboxListItem) => void;
}

const BULK_BAR_ACTIONS = [
	'start',
	'stop',
	'delete',
] as const satisfies readonly SandboxBulkAction[];

const BULK_SHORTCUTS: Record<(typeof BULK_BAR_ACTIONS)[number], string> = {
	start: 's',
	stop: 'x',
	delete: 'del',
};

const PAYMENT_HOLD_STATE = 'requires_action';
const PAYMENT_HOLD_LABEL = 'Payment hold';
const SNAPSHOT_TAIL_CHARACTERS = 8;
const SANDBOX_ID_PREVIEW_CHARACTERS = 8;
const COLUMN_WIDTH = {
	state: 120,
	location: 168,
	lastActivity: 128,
} as const;
const NAME_COLUMN_GROW = 3;
const SNAPSHOT_COLUMN_GROW = 2;
</script>

<script lang="ts">
import CreditCard from '@lucide/svelte/icons/credit-card';
import Plus from '@lucide/svelte/icons/plus';
import Square from '@lucide/svelte/icons/square';
import { renderSnippet } from '@tanstack/svelte-table';
import type { Snippet } from 'svelte';
import Play from '#lib/components/icons/play.svelte';
import TerminalWindow from '#lib/components/icons/terminal-window.svelte';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import ResourceRowContextMenu from '#lib/components/resource/resource-row-context-menu.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import {
	resourceCell,
	resourceTextCell,
} from '#lib/components/resource/table/resource-cells.ts';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import {
	EMPTY_CELL_PLACEHOLDER,
	QUICK_ACTION_COLUMN_PX,
} from '#lib/components/resource/table/resource-table.ts';
import {
	type ResourceColumnDefs,
	resourceColumnHelper,
} from '#lib/components/resource/table/resource-table-model.ts';
import { copyWithToast } from '#lib/components/ui/clipboard/copy-with-toast.ts';
import CopyableText from '#lib/components/ui/clipboard/copyable-text.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import { formatLocation } from '#lib/features/locations/lib/location-format.ts';
import {
	SANDBOX_ACTION_COPY,
	sandboxRowActions,
	sandboxSelectionActions,
	selectionActionLabel,
} from '#lib/features/sandboxes/lib/sandbox-list-actions.ts';
import { sandboxPaymentHold } from '#lib/features/sandboxes/lib/sandbox-payment-hold.ts';
import {
	canDeleteSandbox,
	canRunSandboxLifecycleAction,
	sandboxStateLabel,
} from '#lib/features/sandboxes/lib/sandbox-state.ts';
import { sandboxStateReason } from '#lib/features/sandboxes/lib/sandbox-stop-reason.ts';
import { goto, preloadData } from '$app/navigation';
import { resolve } from '$app/paths';

let {
	sandboxes,
	selectedRowIds = $bindable([]),
	sortConfig,
	isLoading,
	isFetching,
	isError,
	onRetry,
	permissions,
	empty,
	onCreate,
	onAction,
	onDelete,
	onOpenTerminal,
}: SandboxesTableProps = $props();

const selected = $derived(
	sandboxes.filter((sandbox) => selectedRowIds.includes(sandbox.id))
);
const counts: Record<SandboxBulkAction, number> = $derived({
	start: eligible(selected, 'start').length,
	pause: eligible(selected, 'pause').length,
	stop: eligible(selected, 'stop').length,
	archive: eligible(selected, 'archive').length,
	recover: eligible(selected, 'recover').length,
	delete: selected.filter(canDeleteSandbox).length,
});
const emptyContextActions: ResourceRowAction[] = $derived([
	{
		icon: Plus,
		label: 'New sandbox',
		onSelect: onCreate,
		disabled: !permissions.canWrite,
	},
]);
const bulkActions = $derived(
	BULK_BAR_ACTIONS.filter(
		(action) =>
			counts[action] > 0 &&
			(action === 'delete' ? permissions.canDelete : permissions.canWrite)
	).map((action) => ({
		id: action,
		label: selectionActionLabel(action, counts[action]),
		icon: SANDBOX_ACTION_COPY[action].icon,
		destructive: action === 'delete',
		shortcut: BULK_SHORTCUTS[action],
		onSelect: () =>
			action === 'delete'
				? onDelete(selected.filter(canDeleteSandbox))
				: onAction(action, eligible(selected, action)),
	}))
);

const column = resourceColumnHelper<SandboxListItem>();
const columns: ResourceColumnDefs<SandboxListItem> = $derived([
	column.display({
		id: 'selection',
		header: 'Select',
		meta: { variant: 'selection' },
	}),
	column.accessor('name', {
		header: 'Name',
		meta: { grow: NAME_COLUMN_GROW },
		cell: ({ row }) => resourceCell({ content: nameCell }, row.original),
	}),
	column.accessor('state', {
		header: 'State',
		meta: { width: COLUMN_WIDTH.state },
		cell: ({ row }) => renderSnippet(stateCell, row.original),
	}),
	column.accessor('snapshot', {
		header: 'Snapshot',
		meta: { grow: SNAPSHOT_COLUMN_GROW, visibleFrom: 'md' },
		cell: ({ row }) => renderSnippet(snapshotCell, row.original),
	}),
	column.accessor('location', {
		header: 'Location',
		meta: { width: COLUMN_WIDTH.location, visibleFrom: '2xl' },
		cell: ({ getValue }) =>
			resourceTextCell({ label: formatLocation(getValue()) }),
	}),
	column.accessor('lastActivityAt', {
		id: SandboxListSortField.LastActivityAt,
		header: 'Last activity',
		meta: { width: COLUMN_WIDTH.lastActivity, visibleFrom: 'md' },
		cell: ({ row }) => renderSnippet(activityCell, row.original),
	}),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions', width: QUICK_ACTION_COLUMN_PX },
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	}),
]);

function eligible(
	targets: readonly SandboxListItem[],
	action: SandboxLifecycleAction
): SandboxListItem[] {
	return targets.filter((sandbox) =>
		canRunSandboxLifecycleAction(sandbox, action)
	);
}

function rowActions(sandbox: SandboxListItem): ResourceRowAction[] {
	const hold = sandboxPaymentHold(sandbox);
	const actions: ResourceRowAction[] = [
		{
			icon: TerminalWindow,
			label: 'Open terminal',
			visible: permissions.canWrite && sandbox.state === SandboxState.Started,
			onSelect: () => onOpenTerminal(sandbox),
		},
		...sandboxRowActions(sandbox, permissions, {
			onAction: (action) => onAction(action, [sandbox]),
			onCopyId: () => void copyWithToast(sandbox.id, 'sandbox ID'),
			onDelete: () => onDelete([sandbox]),
		}),
	];
	if (!hold) return actions;
	return [
		{
			icon: CreditCard,
			label: hold.fixLabel,
			onSelect: () => void goto(hold.fixHref),
		},
		...actions,
	];
}

function targetRow(rowId: string | null): void {
	if (rowId && !selectedRowIds.includes(rowId)) selectedRowIds = [rowId];
}

function contextActions(rowId: string | null): ResourceRowAction[] {
	const sandbox = sandboxes.find((candidate) => candidate.id === rowId);
	if (!sandbox) return emptyContextActions;
	if (selected.length > 1 && selectedRowIds.includes(sandbox.id)) {
		return sandboxSelectionActions(counts, permissions, {
			onAction: (action) => onAction(action, eligible(selected, action)),
			onDelete: () => onDelete(selected.filter(canDeleteSandbox)),
		});
	}
	return rowActions(sandbox);
}

function quickActions(sandbox: SandboxListItem): ResourceRowAction[] {
	if (!permissions.canWrite) return [];
	return [
		{
			icon: Play,
			label: 'Start',
			visible: canRunSandboxLifecycleAction(sandbox, 'start'),
			onSelect: () => onAction('start', [sandbox]),
		},
		{
			icon: Square,
			label: 'Stop',
			visible: canRunSandboxLifecycleAction(sandbox, 'stop'),
			onSelect: () => onAction('stop', [sandbox]),
		},
	];
}

function sandboxHref(sandboxId: string): string {
	return resolve('/(app)/(dashboard)/sandboxes/[sandboxId]', { sandboxId });
}
</script>

{#snippet nameCell(sandbox: SandboxListItem)}
	<a
		href={sandboxHref(sandbox.id)}
		class="flex min-w-0 items-baseline gap-2 rounded-sm outline-none hover-hover:underline focus-visible:underline"
	>
		<span class="min-w-0 truncate text-(--text-primary)">{sandbox.name}</span>
		<span class="shrink-0 font-mono text-(--text-subtle) text-xs max-md:hidden">
			{sandbox.id.slice(0, SANDBOX_ID_PREVIEW_CHARACTERS)}
		</span>
	</a>
{/snippet}

{#snippet stateCell(sandbox: SandboxListItem)}
	{const hold = $derived(sandboxPaymentHold(sandbox))}
	{#if hold}
		<ResourceStateBadge
			errorReason={`${sandboxStateLabel(sandbox.state)}: ${hold.cause}`}
			label={PAYMENT_HOLD_LABEL}
			state={PAYMENT_HOLD_STATE}
		/>
	{:else}
		<ResourceStateBadge
			errorReason={sandboxStateReason(sandbox)}
			label={sandboxStateLabel(sandbox.state)}
			state={sandbox.state}
		/>
	{/if}
{/snippet}

{#snippet snapshotCell(sandbox: SandboxListItem)}
	{#if sandbox.snapshot}
		<CopyableText
			value={sandbox.snapshot}
			label="Copy snapshot"
			tail={SNAPSHOT_TAIL_CHARACTERS}
		/>
	{:else}
		<span class="text-(--text-muted)">{EMPTY_CELL_PLACEHOLDER}</span>
	{/if}
{/snippet}

{#snippet activityCell(sandbox: SandboxListItem)}
	{#if sandbox.lastActivityAt}
		<Timestamp value={sandbox.lastActivityAt} />
	{:else}
		<span class="text-(--text-muted)">{EMPTY_CELL_PLACEHOLDER}</span>
	{/if}
{/snippet}

{#snippet actionsCell(sandbox: SandboxListItem)}
	<ResourceRowActions
		label={`Actions for ${sandbox.name}`}
		actions={rowActions(sandbox)}
		quick={quickActions(sandbox)}
	/>
{/snippet}

<ResourceRowContextMenu actionsFor={contextActions} onTarget={targetRow}>
	<ResourceDataTable
		caption="Sandboxes"
		{columns}
		data={sandboxes}
		getRowId={(sandbox) => sandbox.id}
		{sortConfig}
		sortedByServer
		rowLabel={(sandbox) => sandbox.name}
		{isLoading}
		{isFetching}
		errorMessage={isError ? "Couldn't load sandboxes" : undefined}
		{onRetry}
		{empty}
		selection={{
			selectedRowIds,
			onChange: (ids) => (selectedRowIds = ids),
		}}
		{bulkActions}
		onDeleteSelection={() => {
			if (permissions.canDelete && counts.delete > 0) {
				onDelete(selected.filter(canDeleteSandbox));
			}
		}}
		onRowClick={(sandboxId) => void goto(sandboxHref(sandboxId))}
		onRowHover={(sandboxId) => void preloadData(sandboxHref(sandboxId))}
		rowContextMenu
	/>
</ResourceRowContextMenu>
