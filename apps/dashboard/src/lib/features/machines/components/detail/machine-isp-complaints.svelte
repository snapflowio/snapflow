<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Download from '@lucide/svelte/icons/download';
import Plus from '@lucide/svelte/icons/plus';
import ShieldAlert from '@lucide/svelte/icons/shield-alert';
import type { IspComplaint } from '@snapflow/api-client';
import { renderComponent } from '@tanstack/svelte-table';
import EmptyState from '#lib/components/empty-state.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import PageColumn from '#lib/components/page/page-column.svelte';
import ResourceDetailsPanel from '#lib/components/resource/resource-details-panel.svelte';
import { resourceTextCell } from '#lib/components/resource/table/resource-cells.ts';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import {
	type ResourceColumnDefs,
	resourceColumnHelper,
} from '#lib/components/resource/table/resource-table-model.ts';
import { timestampCell } from '#lib/components/resource/table/rich-cells.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import StatusLabel from '#lib/components/ui/status/status-label.svelte';
import ForwardIspComplaintModal from '#lib/features/machines/components/detail/forward-isp-complaint-modal.svelte';
import {
	ispDestinationLabel,
	ispOutcomeCopy,
	ispOutcomeStatus,
	ispProtocolLabel,
	ispWindowLabel,
} from '#lib/features/machines/lib/isp-complaint.ts';
import { getMachineDetail } from '#lib/features/machines/state/machine-detail.svelte.ts';
import { MachineIspComplaints } from '#lib/features/machines/state/machine-isp-complaints.svelte.ts';
import { OpenRowParam } from '#lib/routing/open-row-param.svelte.ts';
import { pluralize, sentenceCase } from '#lib/utils/text.ts';

const WRITE_REQUIRED = 'Ask a member who manages machines';
const PANEL_PARAM = 'id';

const detail = getMachineDetail();
const complaints = new MachineIspComplaints(detail);
const panel = new OpenRowParam(
	() => complaints.complaints,
	(complaint) => complaint.id,
	{ param: PANEL_PARAM }
);

detail.usePageActions(() => [
	{
		id: 'forward-complaint',
		label: 'Forward complaint',
		icon: Plus,
		onSelect: complaints.open,
		disabled: !complaints.canForward,
		disabledReason: WRITE_REQUIRED,
	},
]);

const COLUMN_PX = { received: 172, protocol: 104, outcome: 200 } as const;
const column = resourceColumnHelper<IspComplaint>();
const columns: ResourceColumnDefs<IspComplaint> = [
	column.accessor((complaint) => ispDestinationLabel(complaint.ispComplaint), {
		id: 'destination',
		header: 'Destination',
		meta: { grow: 1 },
		cell: ({ getValue }) => resourceTextCell({ label: getValue() }),
	}),
	column.accessor('createdAt', {
		id: 'received',
		header: 'Received',
		meta: { width: COLUMN_PX.received },
		cell: ({ row }) => timestampCell(row.original.createdAt),
	}),
	column.accessor((complaint) => ispProtocolLabel(complaint.ispComplaint), {
		id: 'protocol',
		header: 'Protocol',
		meta: { width: COLUMN_PX.protocol },
		cell: ({ getValue }) => resourceTextCell({ label: getValue() }),
	}),
	column.display({
		id: 'outcome',
		header: 'Outcome',
		meta: { width: COLUMN_PX.outcome },
		cell: ({ row }) =>
			renderComponent(StatusLabel, ispOutcomeStatus(row.original)),
	}),
];
</script>

{#snippet overlay()}
	<ResourceDetailsPanel
		open={panel.row !== null}
		title="ISP complaint"
		onClose={panel.close}
		onPrevious={panel.previous}
		onNext={panel.next}
	>
		{#if panel.row}
			{const complaint = $derived(panel.row)}
			<div class="flex flex-col gap-4 pt-2">
				<p class="text-(--text-body) text-sm">
					{ispOutcomeCopy(complaint).description}
				</p>
				<KeyValueList framed={false}>
					<KeyValueRow label="Outcome">
						<StatusLabel {...ispOutcomeStatus(complaint)} />
					</KeyValueRow>
					<KeyValueRow label="Status" value={sentenceCase(complaint.status)} />
					<KeyValueRow
						label="Destination"
						mono
						value={ispDestinationLabel(complaint.ispComplaint)}
					/>
					<KeyValueRow
						label="Source"
						mono
						value={complaint.ispComplaint?.sourceAddress ?? null}
					/>
					<KeyValueRow
						label="Protocol"
						value={ispProtocolLabel(complaint.ispComplaint)}
					/>
					<KeyValueRow
						label="Traffic"
						value={ispWindowLabel(complaint.ispComplaint)}
					/>
				</KeyValueList>
				<Chip
					variant="secondary"
					size="compact"
					class="self-start"
					leftIcon={Download}
					loading={complaints.statement.isPending}
					onclick={() => complaints.download(complaint)}
				>
					Download statement
				</Chip>
			</div>
		{/if}
	</ResourceDetailsPanel>
{/snippet}

{#if complaints.query.isSuccess && complaints.complaints.length === 0}
	<PageColumn>
		<EmptyState icon={ShieldAlert} bordered={false} title="No ISP complaints">
			<p>Abuse reports your ISP sends you can be forwarded here for review.</p>
			{#snippet actions()}
				<Chip
					variant="secondary"
					leftIcon={Plus}
					disabledReason={complaints.canForward ? undefined : WRITE_REQUIRED}
					onclick={complaints.open}
				>
					Forward complaint
				</Chip>
			{/snippet}
		</EmptyState>
	</PageColumn>
{:else}
	<div class="relative flex min-h-0 flex-1 flex-col border-border border-t">
		<ResourceDataTable
			caption="ISP complaints"
			{columns}
			data={complaints.complaints}
			getRowId={(complaint) => complaint.id}
			rowLabel={(complaint) => ispDestinationLabel(complaint.ispComplaint)}
			isLoading={complaints.query.isLoading}
			isFetching={complaints.query.isFetching}
			errorMessage={complaints.query.isError
				? "Couldn't load ISP complaints"
				: undefined}
			onRetry={() => void complaints.query.refetch()}
			emptyMessage="No ISP complaints"
			selectedRowId={panel.openId}
			onRowClick={panel.open}
			{overlay}
			footer={complaints.complaints.length > 0
				? pluralize(complaints.complaints.length, 'complaint')
				: undefined}
		/>
	</div>
{/if}
<ForwardIspComplaintModal {complaints} />
