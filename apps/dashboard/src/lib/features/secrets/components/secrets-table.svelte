<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { SecretDto } from '@snapflow/api-client';
import type { Snippet } from 'svelte';
import type { ResourceSortConfig } from '#lib/components/resource/resource-options.ts';
import type { ResourcePaginationConfig } from '#lib/components/resource/resource-pagination.ts';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';

const NAME_COLUMN_GROW = 3;
const DESCRIPTION_COLUMN_GROW = 2;
const COLUMN_WIDTH = {
	version: 88,
	updated: 112,
	created: 112,
} as const;

interface SecretsTableProps {
	secrets: readonly SecretDto[];
	isLoading: boolean;
	isError: boolean;
	openSecretId: string | null;
	onRetry: () => void;
	onOpen: (secretId: string) => void;
	rowActions: (secret: SecretDto) => readonly ResourceRowAction[];
	sortConfig: ResourceSortConfig;
	pagination: ResourcePaginationConfig;
	footer: string;
	empty: Snippet;
}
</script>

<script lang="ts">
import { renderSnippet } from '@tanstack/svelte-table';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import { resourceTextCell } from '#lib/components/resource/table/resource-cells.ts';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import {
	type ResourceColumnDefs,
	resourceColumnHelper,
} from '#lib/components/resource/table/resource-table-model.ts';
import { timestampCell } from '#lib/components/resource/table/rich-cells.ts';

let {
	secrets,
	isLoading,
	isError,
	openSecretId,
	onRetry,
	onOpen,
	rowActions,
	sortConfig,
	pagination,
	footer,
	empty,
}: SecretsTableProps = $props();

const column = resourceColumnHelper<SecretDto>();
const columns: ResourceColumnDefs<SecretDto> = [
	column.accessor('name', {
		header: 'Name',
		meta: { grow: NAME_COLUMN_GROW },
		cell: ({ row }) => renderSnippet(nameCell, row.original),
	}),
	column.accessor('description', {
		header: 'Description',
		meta: { grow: DESCRIPTION_COLUMN_GROW, visibleFrom: 'md' },
		cell: ({ getValue }) => resourceTextCell({ label: getValue() }),
	}),
	column.accessor('currentVersion', {
		id: 'version',
		header: 'Version',
		meta: { width: COLUMN_WIDTH.version },
		cell: ({ getValue }) => resourceTextCell({ label: `v${getValue()}` }),
	}),
	column.accessor('updatedAt', {
		id: 'updated',
		header: 'Updated',
		meta: { width: COLUMN_WIDTH.updated },
		cell: ({ getValue }) => timestampCell(getValue()),
	}),
	column.accessor('createdAt', {
		id: 'created',
		header: 'Created',
		meta: { width: COLUMN_WIDTH.created, visibleFrom: 'lg' },
		cell: ({ getValue }) => timestampCell(getValue()),
	}),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions' },
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	}),
];
</script>

{#snippet nameCell(secret: SecretDto)}
	<span class="block min-w-0 truncate font-mono text-(--text-primary) text-xs">
		{secret.name}
	</span>
{/snippet}

{#snippet actionsCell(secret: SecretDto)}
	<ResourceRowActions
		label={`Actions for ${secret.name}`}
		actions={rowActions(secret)}
	/>
{/snippet}

<ResourceDataTable
	caption="Secrets"
	{columns}
	data={secrets}
	getRowId={(secret) => secret.id}
	rowLabel={(secret) => secret.name}
	{sortConfig}
	sortedByServer
	{pagination}
	{footer}
	{isLoading}
	errorMessage={isError ? "Couldn't load secrets" : undefined}
	{onRetry}
	{empty}
	selectedRowId={openSecretId}
	onRowClick={onOpen}
	rowContextMenu
/>
