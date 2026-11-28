<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { ResourceSortState } from '#lib/components/resource/table/resource-table-sort.ts';

const DEFAULT_SORT: ResourceSortState = {
	column: 'pending',
	direction: 'desc',
};
const SORT_OPTIONS = [
	{ id: 'machine', label: 'Machine' },
	{ id: 'pending', label: 'Not paid out' },
	{ id: 'paid', label: 'Paid out' },
] as const;
const STATE_COLUMN_PX = 136;
const MONEY_COLUMN_PX = 136;
const NEXT_COLUMN_PX = 232;
</script>

<script lang="ts">
import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
import History from '@lucide/svelte/icons/history';
import ServerIcon from '@lucide/svelte/icons/server';
import type {
	HostEscrowBalance,
	HostMachineEarnings,
} from '@snapflow/api-client';
import { renderSnippet } from '@tanstack/svelte-table';
import EmptyState from '#lib/components/empty-state.svelte';
import type { ResourceSortConfig } from '#lib/components/resource/resource-options.ts';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import ResourceRowContextMenu from '#lib/components/resource/resource-row-context-menu.svelte';
import { resourceCell } from '#lib/components/resource/table/resource-cells.ts';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import {
	type ResourceColumnDefs,
	resourceColumnHelper,
} from '#lib/components/resource/table/resource-table-model.ts';
import Badge from '#lib/components/ui/badge.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Meter from '#lib/components/ui/meter.svelte';
import Money from '#lib/components/ui/money.svelte';
import {
	machineEarningsStatus,
	PAYOUT_PERCENT_SCALE,
	payoutProgressPercent,
	statusBadgeVariant,
} from '#lib/features/earnings/lib/earnings-status.ts';
import { machineListingHref } from '#lib/features/machines/lib/machine-listing-link.ts';
import { pluralize } from '#lib/utils/text.ts';
import { goto } from '$app/navigation';

interface MachineEarningsTableProps {
	balance: HostEscrowBalance | undefined;
	isLoading: boolean;
	isFetching: boolean;
	errorMessage?: string;
	canAddMachine: boolean;
	addMachineHref: string;
	selectedRowId: string | null;
	onOpen: (rowId: string) => void;
	onRetry: () => void;
	onShowPayouts: (machineId: string) => void;
}

let {
	balance,
	isLoading,
	isFetching,
	errorMessage,
	canAddMachine,
	addMachineHref,
	selectedRowId,
	onOpen,
	onRetry,
	onShowPayouts,
}: MachineEarningsTableProps = $props();

const machines = $derived(balance?.machines ?? []);
let sort = $state<ResourceSortState>(DEFAULT_SORT);
const sortConfig = $derived<ResourceSortConfig>({
	options: SORT_OPTIONS,
	active: sort,
	onSort: (column, direction) => {
		sort = { column, direction };
	},
});
const byKey = $derived(
	new Map(machines.map((machine) => [machine.hostAddress, machine]))
);

const column = resourceColumnHelper<HostMachineEarnings>();
const columns: ResourceColumnDefs<HostMachineEarnings> = [
	column.accessor('machineName', {
		id: 'machine',
		header: 'Machine',
		meta: { grow: 2 },
		cell: ({ row }) =>
			resourceCell({ label: row.original.machineName }, row.original),
	}),
	column.display({
		id: 'state',
		header: 'State',
		meta: { width: STATE_COLUMN_PX },
		cell: ({ row }) => renderSnippet(stateCell, row.original),
	}),
	column.accessor((machine) => Number(machine.pendingMicroUsd), {
		id: 'pending',
		header: 'Not paid out',
		meta: { align: 'end', width: MONEY_COLUMN_PX, compact: true },
		cell: ({ row }) => renderSnippet(moneyCell, row.original.pendingMicroUsd),
	}),
	column.accessor((machine) => Number(machine.withdrawnMicroUsd), {
		id: 'paid',
		header: 'Paid out',
		meta: { align: 'end', width: MONEY_COLUMN_PX, visibleFrom: 'md' },
		cell: ({ row }) => renderSnippet(mutedMoneyCell, row.original),
	}),
	column.display({
		id: 'next',
		header: 'Next payout',
		meta: { align: 'end', width: NEXT_COLUMN_PX, visibleFrom: 'xl' },
		cell: ({ row }) => renderSnippet(nextCell, row.original),
	}),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions' },
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	}),
];

function rowActions(machine: HostMachineEarnings): ResourceRowAction[] {
	return [
		{
			icon: ArrowUpRight,
			label: 'Open machine',
			onSelect: () => void goto(machineListingHref(machine.machineId)),
		},
		{
			icon: History,
			label: 'View payouts',
			onSelect: () => onShowPayouts(machine.machineId),
		},
	];
}

function actionsFor(rowId: string | null): ResourceRowAction[] {
	const machine = rowId ? byKey.get(rowId) : undefined;
	return machine ? rowActions(machine) : [];
}
</script>

{#snippet stateCell(machine: HostMachineEarnings)}
	{const status = $derived(machineEarningsStatus(machine))}
	<Badge
		size="sm"
		variant={statusBadgeVariant(status)}
		tooltip={status.description ?? undefined}
	>
		{status.label}
	</Badge>
{/snippet}

{#snippet moneyCell(microUsd: string)}
	<Money {microUsd} class="text-(--text-primary)" />
{/snippet}

{#snippet mutedMoneyCell(machine: HostMachineEarnings)}
	<Money microUsd={machine.withdrawnMicroUsd} class="text-(--text-muted)" />
{/snippet}

{#snippet nextCell(machine: HostMachineEarnings)}
	{const percent = $derived(payoutProgressPercent(machine))}
	<span class="flex min-w-0 items-center justify-end gap-3">
		{#if percent !== null}
			<Meter
				variant="compact"
				class="w-16 shrink-0"
				label={`${machine.machineName} progress to the next payout`}
				value={percent}
				maximum={PAYOUT_PERCENT_SCALE}
				valueText={`${percent}%`}
				tone="default"
			/>
		{/if}
		{#if machine.payoutDue && machine.netPayoutMicroUsd}
			<Money microUsd={machine.netPayoutMicroUsd} />
		{:else}
			<span class="truncate text-(--text-muted)">Below minimum</span>
		{/if}
	</span>
{/snippet}

{#snippet actionsCell(machine: HostMachineEarnings)}
	<ResourceRowActions
		label={`Actions for ${machine.machineName}`}
		actions={rowActions(machine)}
	/>
{/snippet}

{#snippet empty()}
	<EmptyState icon={ServerIcon} bordered={false} title="No machines yet">
		<p>Machines you add appear here with what each one has earned.</p>
		{#snippet actions()}
			<Chip
				variant="secondary"
				href={addMachineHref}
				disabledReason={canAddMachine
					? undefined
					: 'Ask a member who manages machines'}
			>
				Add machine
			</Chip>
		{/snippet}
	</EmptyState>
{/snippet}

<ResourceRowContextMenu {actionsFor}>
	<ResourceDataTable
		caption="Machine earnings"
		variant="framed"
		footer={machines.length > 0
			? pluralize(machines.length, 'machine')
			: undefined}
		{columns}
		data={machines}
		getRowId={(machine) => machine.hostAddress}
		rowLabel={(machine) => machine.machineName}
		{sortConfig}
		{isLoading}
		{isFetching}
		{errorMessage}
		{onRetry}
		{empty}
		{selectedRowId}
		onRowClick={onOpen}
		rowContextMenu
	/>
</ResourceRowContextMenu>
