<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { WebhookDelivery } from '@snapflow/api-client';
import type { Snippet } from 'svelte';

const TIME_COLUMN_WIDTH = 140;
const STATUS_COLUMN_WIDTH = 136;
const RESPONSE_COLUMN_WIDTH = 96;

interface WebhookDeliveryListProps {
	deliveries: readonly WebhookDelivery[];
	selectedId: string | null;
	onSelect: (id: string) => void;
	isLoading: boolean;
	isFetching: boolean;
	errorMessage?: string;
	onRetry: () => void;
	empty: Snippet;
	hasMore: boolean;
	loadingMore: boolean;
	onLoadMore: () => void;
}
</script>

<script lang="ts">
import { renderSnippet } from '@tanstack/svelte-table';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import {
	type ResourceColumnDefs,
	resourceColumnHelper,
} from '#lib/components/resource/table/resource-table-model.ts';
import StatusLabel from '#lib/components/ui/status/status-label.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import {
	deliveryStatusDisplay,
	responseCodeLabel,
} from '#lib/features/webhooks/lib/webhook-display.ts';
import { webhookEventLabel } from '#lib/features/webhooks/lib/webhook-events.ts';

let {
	deliveries,
	selectedId,
	onSelect,
	isLoading,
	isFetching,
	errorMessage,
	onRetry,
	empty,
	hasMore,
	loadingMore,
	onLoadMore,
}: WebhookDeliveryListProps = $props();

const column = resourceColumnHelper<WebhookDelivery>();
const columns: ResourceColumnDefs<WebhookDelivery> = [
	column.display({
		id: 'time',
		header: 'Time',
		meta: { width: TIME_COLUMN_WIDTH },
		cell: ({ row }) => renderSnippet(timeCell, row.original),
	}),
	column.display({
		id: 'event',
		header: 'Event',
		meta: { grow: 1 },
		cell: ({ row }) => webhookEventLabel(row.original.eventType),
	}),
	column.display({
		id: 'status',
		header: 'Status',
		meta: { width: STATUS_COLUMN_WIDTH },
		cell: ({ row }) => renderSnippet(statusCell, row.original),
	}),
	column.display({
		id: 'response',
		header: 'Response',
		meta: { width: RESPONSE_COLUMN_WIDTH, align: 'end', visibleFrom: 'md' },
		cell: ({ row }) => renderSnippet(responseCell, row.original),
	}),
];
</script>

{#snippet timeCell(delivery: WebhookDelivery)}
	<Timestamp value={delivery.createdAt} class="text-(--text-muted)" />
{/snippet}

{#snippet statusCell(delivery: WebhookDelivery)}
	{const status = $derived(deliveryStatusDisplay(delivery))}
	<StatusLabel
		label={status.label}
		shape={status.shape}
		tone={status.tone}
		live={status.live}
	/>
{/snippet}

{#snippet responseCell(delivery: WebhookDelivery)}
	<span class="font-mono text-(--text-secondary) text-xs">
		{responseCodeLabel(delivery.lastResponseStatus)}
	</span>
{/snippet}

<ResourceDataTable
	caption="Deliveries"
	{columns}
	data={deliveries}
	getRowId={(delivery) => delivery.id}
	rowLabel={(delivery) => webhookEventLabel(delivery.eventType)}
	selectedRowId={selectedId}
	onRowClick={onSelect}
	{isLoading}
	{isFetching}
	{errorMessage}
	{onRetry}
	{empty}
	{hasMore}
	{loadingMore}
	{onLoadMore}
/>
