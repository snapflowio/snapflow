<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type {
	MachinePaymentHold,
	MachinePaymentHolds,
} from '@snapflow/api-client';

const SANDBOX_ID_PREFIX_LENGTH = 8;
const HELD_COLUMN_PX = 160;
const NO_HOLDS_MESSAGE = 'No payment holds.';
const NOT_REPORTED_MESSAGE = 'Not reported yet.';
</script>

<script lang="ts">
import { renderSnippet } from '@tanstack/svelte-table';
import DetailSection from '#lib/components/detail/detail-section.svelte';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import {
	type ResourceColumnDefs,
	resourceColumnHelper,
} from '#lib/components/resource/table/resource-table-model.ts';
import StatusLabel from '#lib/components/ui/status/status-label.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import { PAYMENT_HOLD_REASON_LABELS } from '#lib/features/machines/lib/machine-health.ts';

interface MachinePaymentHoldsSectionProps {
	paymentHolds: MachinePaymentHolds | null;
	separated?: boolean;
}

let { paymentHolds, separated = false }: MachinePaymentHoldsSectionProps =
	$props();

const holds = $derived(paymentHolds?.holds ?? []);

const column = resourceColumnHelper<MachinePaymentHold>();
const columns: ResourceColumnDefs<MachinePaymentHold> = [
	column.display({
		id: 'sandbox',
		header: 'Sandbox',
		meta: { grow: 1 },
		cell: ({ row }) => renderSnippet(sandboxCell, row.original),
	}),
	column.display({
		id: 'reason',
		header: 'Reason',
		meta: { grow: 2 },
		cell: ({ row }) => renderSnippet(reasonCell, row.original),
	}),
	column.display({
		id: 'held',
		header: 'Held',
		meta: { align: 'end', width: HELD_COLUMN_PX },
		cell: ({ row }) => renderSnippet(heldCell, row.original),
	}),
];
</script>

{#snippet sandboxCell(hold: MachinePaymentHold)}
	<span class="truncate font-mono text-xs">
		{hold.sandboxId.slice(0, SANDBOX_ID_PREFIX_LENGTH)}
	</span>
{/snippet}

{#snippet reasonCell(hold: MachinePaymentHold)}
	<StatusLabel
		label={PAYMENT_HOLD_REASON_LABELS[hold.reason]}
		shape="paused"
		tone="warning"
		description={hold.detail}
	/>
{/snippet}

{#snippet heldCell(hold: MachinePaymentHold)}
	<span class="text-(--text-muted)"><Timestamp value={hold.heldAt} /></span>
{/snippet}

<DetailSection
	title="Payment holds"
	info="Sandboxes paused until their renters pay. They resume on their own."
	{separated}
>
	<ResourceDataTable
		caption="Payment holds"
		variant="framed"
		{columns}
		data={holds}
		getRowId={(hold) => hold.sandboxId}
		emptyMessage={paymentHolds ? NO_HOLDS_MESSAGE : NOT_REPORTED_MESSAGE}
	/>
</DetailSection>
