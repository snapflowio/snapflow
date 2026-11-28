<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import GitFork from '@lucide/svelte/icons/git-fork';
import type { Sandbox } from '@snapflow/api-client';
import { renderSnippet } from '@tanstack/svelte-table';
import DetailSection from '#lib/components/detail/detail-section.svelte';
import EmptyState from '#lib/components/empty-state.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import PageColumn from '#lib/components/page/page-column.svelte';
import { resourceTextCell } from '#lib/components/resource/table/resource-cells.ts';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import { EMPTY_CELL_PLACEHOLDER } from '#lib/components/resource/table/resource-table.ts';
import {
	type ResourceColumnDefs,
	resourceColumnHelper,
} from '#lib/components/resource/table/resource-table-model.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import StatusLabel from '#lib/components/ui/status/status-label.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import {
	backupStatus,
	type RecoveryRow,
	recoveryRows,
} from '#lib/features/sandboxes/lib/sandbox-recovery.ts';
import { getSandboxDetail } from '#lib/features/sandboxes/state/sandbox-detail.svelte.ts';
import { getSandboxDetailActions } from '#lib/features/sandboxes/state/sandbox-detail-actions.svelte.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

const COLUMN_WIDTH = { kind: 120, created: 172, size: 104 } as const;
const NAME_COLUMN_GROW = 2;

const detail = getSandboxDetail();
const actions = getSandboxDetailActions();
const recovery = $derived(actions.recovery);
const sandbox = $derived(detail.sandbox);
const backup = $derived(backupStatus(sandbox));
const rows = $derived(
	detail.forksQuery.data ? recoveryRows(detail.forksQuery.data) : []
);

const column = resourceColumnHelper<RecoveryRow>();
const columns: ResourceColumnDefs<RecoveryRow> = [
	column.display({
		id: 'name',
		header: 'Name',
		meta: { grow: NAME_COLUMN_GROW },
		cell: ({ row }) => renderSnippet(nameCell, row.original.sandbox),
	}),
	column.accessor('kind', {
		header: 'Kind',
		meta: { width: COLUMN_WIDTH.kind },
		cell: ({ getValue }) => resourceTextCell({ label: getValue() }),
	}),
	column.display({
		id: 'created',
		header: 'Created',
		meta: { width: COLUMN_WIDTH.created },
		cell: ({ row }) => renderSnippet(createdCell, row.original.sandbox),
	}),
	column.display({
		id: 'size',
		header: 'Size',
		meta: { width: COLUMN_WIDTH.size, align: 'end' },
		cell: ({ row }) =>
			resourceTextCell({ label: `${row.original.sandbox.disk} GiB` }),
	}),
];

function sandboxHref(sandboxId: string): string {
	return resolve('/(app)/(dashboard)/sandboxes/[sandboxId]', { sandboxId });
}
</script>

{#snippet backupAction()}
	{#if detail.canWrite}
		<Chip
			size="compact"
			variant="secondary"
			loading={recovery.backupMutation.isPending}
			disabled={recovery.backupBlockedReason !== null}
			disabledReason={recovery.backupBlockedReason ?? undefined}
			onclick={() => recovery.backupMutation.mutate()}
		>
			Back up
		</Chip>
	{/if}
{/snippet}

{#snippet forkAction()}
	{#if detail.canWrite}
		<Chip
			size="compact"
			variant="secondary"
			leftIcon={GitFork}
			disabled={recovery.forkBlockedReason !== null}
			disabledReason={recovery.forkBlockedReason ?? undefined}
			onclick={() => recovery.openNamedAction('fork')}
		>
			Fork
		</Chip>
	{/if}
{/snippet}

{#snippet nameCell(row: Sandbox)}
	<a
		href={sandboxHref(row.id)}
		class="min-w-0 truncate rounded-sm text-(--text-primary) outline-none hover-hover:underline focus-visible:underline"
	>
		{row.name}
	</a>
{/snippet}

{#snippet createdCell(row: Sandbox)}
	{#if row.createdAt}
		<Timestamp value={row.createdAt} />
	{:else}
		<span class="text-(--text-muted)">{EMPTY_CELL_PLACEHOLDER}</span>
	{/if}
{/snippet}

{#snippet emptyForks()}
	<EmptyState icon={GitFork} bordered={false} title="No forks yet" />
{/snippet}

<PageColumn class="gap-y-12">
	<DetailSection title="Backup" separated={false} action={backupAction}>
		<KeyValueList label="Backup">
			<KeyValueRow label="Status">
				<StatusLabel
					shape={backup.shape}
					tone={backup.tone}
					label={backup.label}
					description={sandbox.backupErrorReason ?? undefined}
				/>
			</KeyValueRow>
			<KeyValueRow label="Last backup">
				{#if sandbox.backupCreatedAt}
					<Timestamp value={sandbox.backupCreatedAt} />
				{:else}
					<span class="text-(--text-subtle)">Never</span>
				{/if}
			</KeyValueRow>
		</KeyValueList>
	</DetailSection>
	<DetailSection title="Snapshots and forks" action={forkAction}>
		<ResourceDataTable
			caption="Snapshots and forks"
			variant="framed"
			{columns}
			data={rows}
			getRowId={(row) => row.sandbox.id}
			rowLabel={(row) => row.sandbox.name}
			isLoading={detail.forksQuery.isPending}
			errorMessage={detail.forksQuery.isError
				? "Couldn't load snapshots and forks"
				: undefined}
			onRetry={() => void detail.forksQuery.refetch()}
			empty={emptyForks}
			onRowClick={(sandboxId) => void goto(sandboxHref(sandboxId))}
		/>
	</DetailSection>
</PageColumn>
