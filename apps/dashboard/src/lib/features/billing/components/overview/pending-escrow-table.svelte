<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { PendingDepositKind } from '@snapflow/api-client';
import { renderSnippet } from '@tanstack/svelte-table';
import { EMPTY_CELL_PLACEHOLDER } from '#lib/components/resource/table/resource-table.ts';
import { resourceColumnHelper } from '#lib/components/resource/table/resource-table-model.ts';
import { addressCell } from '#lib/components/resource/table/rich-cells.ts';
import { formatRemaining } from '#lib/features/billing/lib/escrow-terms.ts';
import { formatCountdown } from '#lib/features/billing/lib/format.ts';
import {
	type PendingEscrowRow,
	PendingWithdrawalState,
} from '#lib/features/billing/lib/pending-escrow.ts';

const COUNTDOWN_REFRESH_MILLISECONDS = 30_000;
const MILLISECONDS_PER_SECOND = 1_000;
const STATUS_COLUMN_GROW = 2;
const AMOUNT_COLUMN_WIDTH = 104;
const EXPECTED_COLUMN_WIDTH = 160;
const TRANSACTION_COLUMN_WIDTH = 128;
const WAITING_LABEL = 'Waiting for the network';
const DELAYED_LABEL = 'Network delays';

const WITHDRAWAL_LABELS = {
	[PendingWithdrawalState.Requesting]: 'Withdrawal requested',
	[PendingWithdrawalState.Locked]: 'Withdrawing',
	[PendingWithdrawalState.Unlocked]: 'Ready to complete',
	[PendingWithdrawalState.Frozen]: 'Paused while frozen',
	[PendingWithdrawalState.Cancelling]: 'Cancelling…',
	[PendingWithdrawalState.Completing]: 'Completing…',
} as const satisfies Record<PendingWithdrawalState, string>;

const column = resourceColumnHelper<PendingEscrowRow>();

function processingTooltip(networkName: string): string {
	return `Your deposit is on ${networkName}. It counts once the network marks it safe, usually within a few minutes.`;
}

function rowLabel(row: PendingEscrowRow): string {
	if (row.kind === 'withdrawal') return WITHDRAWAL_LABELS[row.state];
	return row.source === PendingDepositKind.Wallet
		? 'Arriving in your wallet'
		: 'Processing';
}

function signedAmount(row: PendingEscrowRow): bigint {
	return row.kind === 'deposit' ? row.amountMicroUsd : -row.amountMicroUsd;
}

function cancellable(row: PendingEscrowRow): boolean {
	return (
		row.kind === 'withdrawal' &&
		row.state === PendingWithdrawalState.Locked &&
		row.cancellable
	);
}

function completable(row: PendingEscrowRow): boolean {
	return (
		row.kind === 'withdrawal' && row.state === PendingWithdrawalState.Unlocked
	);
}

interface PendingEscrowTableProps {
	rows: readonly PendingEscrowRow[];
	delayed: boolean;
	actionReason: string | null;
	onCancel: () => void;
	onComplete: () => void;
}
</script>

<script lang="ts">
import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
import X from '@lucide/svelte/icons/x';
import { useInterval } from 'runed';
import { getPublicConfig } from '#lib/api/public-config.ts';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import Money from '#lib/components/ui/money.svelte';
import StatusRing from '#lib/components/ui/status/status-ring.svelte';
import Tooltip from '#lib/components/ui/tooltip/tooltip.svelte';
import { pendingRowStatus } from '#lib/features/billing/lib/pending-escrow.ts';
import { settlementChain } from '#lib/integrations/wallet/wallet-networks.ts';
import { formatDateTime } from '#lib/utils/format.ts';

let {
	rows,
	delayed,
	actionReason,
	onCancel,
	onComplete,
}: PendingEscrowTableProps = $props();

const networkName = settlementChain(getPublicConfig().settlement.chainId).name;
let now = $state(Date.now());
useInterval(COUNTDOWN_REFRESH_MILLISECONDS, {
	callback: () => {
		now = Date.now();
	},
});

function countdown(row: PendingEscrowRow): string | null {
	if (row.kind !== 'withdrawal' || row.state !== PendingWithdrawalState.Locked)
		return null;
	if (!row.availableAt) return null;
	const seconds =
		(new Date(row.availableAt).getTime() - now) / MILLISECONDS_PER_SECOND;
	return `unlocks in ${formatCountdown(seconds)}`;
}

function expectation(row: PendingEscrowRow): string | null {
	if (row.kind === 'withdrawal') {
		return row.state === PendingWithdrawalState.Requesting
			? WAITING_LABEL
			: null;
	}
	if (delayed) return DELAYED_LABEL;
	if (row.etaSeconds === null || row.etaSeconds === 0) return WAITING_LABEL;
	return `~${formatRemaining(row.etaSeconds)}`;
}

function actionsFor(row: PendingEscrowRow): ResourceRowAction[] {
	return [
		{
			label: 'Cancel withdrawal',
			icon: X,
			visible: cancellable(row),
			disabledReason: actionReason ?? undefined,
			onSelect: onCancel,
		},
		{
			label: 'Complete withdrawal',
			icon: ArrowUpRight,
			visible: completable(row),
			disabledReason: actionReason ?? undefined,
			onSelect: onComplete,
		},
	];
}

const columns = [
	column.display({
		id: 'status',
		header: 'Status',
		meta: { grow: STATUS_COLUMN_GROW },
		cell: ({ row }) => renderSnippet(statusCell, row.original),
	}),
	column.display({
		id: 'amount',
		header: 'Amount',
		meta: { width: AMOUNT_COLUMN_WIDTH, align: 'end', compact: true },
		cell: ({ row }) => renderSnippet(amountCell, row.original),
	}),
	column.display({
		id: 'expected',
		header: 'Expected',
		meta: { width: EXPECTED_COLUMN_WIDTH },
		cell: ({ row }) => renderSnippet(expectedCell, row.original),
	}),
	column.display({
		id: 'transaction',
		header: 'Transaction',
		meta: { width: TRANSACTION_COLUMN_WIDTH },
		cell: ({ row }) =>
			row.original.transactionHash
				? addressCell(row.original.transactionHash, 'tx')
				: renderSnippet(emptyCell),
	}),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions' },
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	}),
];
</script>

{#snippet emptyCell()}
	<span class="text-(--text-subtle)">{EMPTY_CELL_PLACEHOLDER}</span>
{/snippet}

{#snippet statusCell(row: PendingEscrowRow)}
	{const status = $derived(pendingRowStatus(row))}
	{const label = $derived(rowLabel(row))}
	<span class="flex min-w-0 items-center gap-2">
		<StatusRing shape={status.shape} tone={status.tone} live={status.live} />
		{#if row.kind === 'deposit' && row.source === PendingDepositKind.Escrow}
			<Tooltip content={processingTooltip(networkName)}>
				{#snippet child({ props })}
					<button
						{...props}
						type="button"
						class="cursor-default truncate rounded-xs text-(--text-primary) text-sm outline-none focus-visible:focus-ring"
					>
						{label}
					</button>
				{/snippet}
			</Tooltip>
		{:else}
			<span
				class={[
					'truncate text-sm',
					status.tone === 'error'
						? 'text-(--text-error)'
						: 'text-(--text-primary)',
				]}
			>
				{label}
			</span>
		{/if}
	</span>
{/snippet}

{#snippet amountCell(row: PendingEscrowRow)}
	<Money class="text-(--text-primary)" microUsd={signedAmount(row)} signed />
{/snippet}

{#snippet expectedCell(row: PendingEscrowRow)}
	{const remaining = $derived(countdown(row))}
	{const meta = $derived(expectation(row))}
	{#if remaining && row.kind === 'withdrawal' && row.availableAt}
		<Tooltip content={formatDateTime(row.availableAt)}>
			{#snippet child({ props })}
				<button
					{...props}
					type="button"
					class="cursor-default truncate rounded-xs text-(--text-muted) tabular-nums outline-none focus-visible:focus-ring"
				>
					{remaining}
				</button>
			{/snippet}
		</Tooltip>
	{:else if meta}
		<span class="truncate text-(--text-muted)">{meta}</span>
	{:else}
		{@render emptyCell()}
	{/if}
{/snippet}

{#snippet actionsCell(row: PendingEscrowRow)}
	<ResourceRowActions
		label={`Actions for ${rowLabel(row).toLowerCase()}`}
		actions={actionsFor(row)}
		reveal="always"
	/>
{/snippet}

<div class="overflow-hidden rounded-2xl border border-border">
	<ResourceDataTable
		caption="Pending changes"
		{columns}
		data={rows}
		getRowId={(row) => row.id}
		{rowLabel}
	/>
</div>
