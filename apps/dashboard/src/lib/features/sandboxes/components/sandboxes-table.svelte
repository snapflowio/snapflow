<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { SandboxListItem } from '@snapflow/api-client';
import type {
	SandboxBulkAction,
	SandboxLifecycleAction,
} from '#lib/api/sandboxes/sandboxes.ts';
import type { ResourceActionPermissions } from '#lib/features/organizations/lib/organization-permission.ts';

interface SandboxesTableProps {
	sandboxes: readonly SandboxListItem[];
	selectedRowIds?: string[];
	isLoading: boolean;
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
}

const BULK_BAR_ACTIONS = [
	'start',
	'pause',
	'stop',
	'archive',
	'recover',
	'delete',
] as const satisfies readonly SandboxBulkAction[];
</script>

<script lang="ts">
import Plus from '@lucide/svelte/icons/plus';
import { renderSnippet } from '@tanstack/svelte-table';
import type { Snippet } from 'svelte';
import TerminalWindow from '#lib/components/icons/terminal-window.svelte';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import ResourceRowActionItems from '#lib/components/resource/resource-row-action-items.svelte';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import {
	resourceCell,
	resourceTextCell,
} from '#lib/components/resource/table/resource-cells.ts';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import {
	type ResourceColumnDefs,
	resourceColumnHelper,
} from '#lib/components/resource/table/resource-table-model.ts';
import { timeCell } from '#lib/components/resource/table/time-cell.ts';
import ContextMenu from '#lib/components/ui/context-menu/context-menu.svelte';
import ContextMenuContent from '#lib/components/ui/context-menu/context-menu-content.svelte';
import ContextMenuTrigger from '#lib/components/ui/context-menu/context-menu-trigger.svelte';
import { formatLocation } from '#lib/features/locations/lib/location-format.ts';
import {
	SANDBOX_ACTION_COPY,
	sandboxRowActions,
	sandboxSelectionActions,
	selectionActionLabel,
} from '#lib/features/sandboxes/lib/sandbox-list-actions.ts';
import {
	canDeleteSandbox,
	canRunSandboxLifecycleAction,
} from '#lib/features/sandboxes/lib/sandbox-state.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

let {
	sandboxes,
	selectedRowIds = $bindable([]),
	isLoading,
	isError,
	onRetry,
	permissions,
	empty,
	onCreate,
	onAction,
	onDelete,
}: SandboxesTableProps = $props();

let contextRowId = $state<string | null>(null);

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
const contextSandbox = $derived(
	sandboxes.find((sandbox) => sandbox.id === contextRowId)
);
const contextActions: ResourceRowAction[] = $derived.by(() => {
	if (!contextSandbox) {
		return [
			{
				icon: Plus,
				label: 'New sandbox',
				onSelect: onCreate,
				disabled: !permissions.canWrite,
			},
		];
	}
	if (selected.length > 1) {
		return sandboxSelectionActions(counts, permissions, {
			onAction: (action) => onAction(action, eligible(selected, action)),
			onDelete: () => onDelete(selected.filter(canDeleteSandbox)),
		});
	}
	return rowActions(contextSandbox);
});
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
		cell: ({ row }) =>
			resourceCell({ icon: nameIcon, label: row.original.name }, row.original),
	}),
	column.accessor('state', {
		header: 'State',
		cell: ({ row }) => renderSnippet(stateCell, row.original),
	}),
	column.accessor('snapshot', {
		header: 'Snapshot',
		cell: ({ getValue }) => resourceTextCell({ label: getValue() }),
	}),
	column.accessor('location', {
		header: 'Location',
		cell: ({ getValue }) =>
			resourceTextCell({ label: formatLocation(getValue()) }),
	}),
	column.display({
		id: 'resources',
		header: 'Resources',
		cell: ({ row }) =>
			resourceTextCell({
				label: `${row.original.cpu} CPU · ${row.original.memory} GiB`,
			}),
	}),
	column.accessor('createdAt', {
		id: 'created',
		header: 'Created',
		cell: ({ getValue }) => resourceTextCell(timeCell(getValue())),
	}),
	column.accessor('lastActivityAt', {
		id: 'lastActivity',
		header: 'Last activity',
		cell: ({ getValue }) => resourceTextCell(timeCell(getValue())),
	}),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions' },
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
	return sandboxRowActions(sandbox, permissions, {
		onAction: (action) => onAction(action, [sandbox]),
		onCopyId: () => void navigator.clipboard.writeText(sandbox.id),
		onDelete: () => onDelete([sandbox]),
	});
}

function sandboxHref(sandboxId: string): string {
	return resolve('/(app)/(dashboard)/sandboxes/[sandboxId]', { sandboxId });
}

function targetRow(_event: MouseEvent, rowId: string): void {
	contextRowId = rowId;
	if (!selectedRowIds.includes(rowId)) selectedRowIds = [rowId];
}
</script>

{#snippet nameIcon()}
	<TerminalWindow />
{/snippet}

{#snippet stateCell(
	sandbox: SandboxListItem
)}
	<ResourceStateBadge errorReason={sandbox.errorReason} state={sandbox.state} />
{/snippet}

{#snippet actionsCell(
	sandbox: SandboxListItem
)}
	<ResourceRowActions
		label={`Actions for ${sandbox.name}`}
		actions={rowActions(sandbox)}
	/>
{/snippet}

<ContextMenu
	onOpenChange={(open) => {
		if (!open) contextRowId = null;
	}}
>
	<ContextMenuTrigger>
		{#snippet child({
			props,
		})}
			<div
				{...props}
				class="flex min-h-0 flex-1 flex-col"
				oncontextmenucapture={() => {
					contextRowId = null;
				}}
			>
				<ResourceDataTable
					caption="Sandboxes"
					{columns}
					data={sandboxes}
					getRowId={(sandbox) => sandbox.id}
					rowLabel={(sandbox) => sandbox.name}
					{isLoading}
					errorMessage={isError ? 'Failed to load sandboxes' : undefined}
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
					onRowContextMenu={targetRow}
				/>
			</div>
		{/snippet}
	</ContextMenuTrigger>
	<ContextMenuContent>
		<ResourceRowActionItems actions={contextActions} />
	</ContextMenuContent>
</ContextMenu>
