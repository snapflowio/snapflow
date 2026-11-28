<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { DockerRegistry } from '@snapflow/api-client';
import type { Snippet } from 'svelte';
import type { ResourceSortConfig } from '#lib/components/resource/resource-options.ts';
import type { ResourcePaginationConfig } from '#lib/components/resource/resource-pagination.ts';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';

const NAME_COLUMN_GROW = 1;
const URL_COLUMN_GROW = 1;
const COLUMN_WIDTH = {
	type: 128,
	username: 160,
	created: 112,
} as const;

interface RegistriesTableProps {
	registries: readonly DockerRegistry[];
	isLoading: boolean;
	isError: boolean;
	openRegistryId: string | null;
	onRetry: () => void;
	onOpen: (registryId: string) => void;
	rowActions: (registry: DockerRegistry) => readonly ResourceRowAction[];
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
import Badge from '#lib/components/ui/badge.svelte';
import { registryTypeLabel } from '#lib/features/registries/lib/registries-list.ts';

let {
	registries,
	isLoading,
	isError,
	openRegistryId,
	onRetry,
	onOpen,
	rowActions,
	sortConfig,
	pagination,
	footer,
	empty,
}: RegistriesTableProps = $props();

const column = resourceColumnHelper<DockerRegistry>();
const columns: ResourceColumnDefs<DockerRegistry> = [
	column.accessor('name', {
		header: 'Name',
		meta: { grow: NAME_COLUMN_GROW },
		cell: ({ getValue }) => resourceTextCell({ label: getValue() }),
	}),
	column.accessor('registryType', {
		id: 'type',
		header: 'Type',
		meta: { width: COLUMN_WIDTH.type },
		cell: ({ row }) => renderSnippet(typeCell, row.original),
	}),
	column.accessor('url', {
		header: 'URL',
		meta: { grow: URL_COLUMN_GROW, visibleFrom: 'md' },
		cell: ({ row }) => renderSnippet(urlCell, row.original),
	}),
	column.accessor('username', {
		header: 'Username',
		meta: { width: COLUMN_WIDTH.username, visibleFrom: 'xl' },
		cell: ({ getValue }) => resourceTextCell({ label: getValue() }),
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

{#snippet typeCell(registry: DockerRegistry)}
	<Badge size="pill">{registryTypeLabel(registry.registryType)}</Badge>
{/snippet}

{#snippet urlCell(registry: DockerRegistry)}
	<span
		class="block min-w-0 truncate font-mono text-(--text-secondary) text-xs"
	>
		{registry.url}
	</span>
{/snippet}

{#snippet actionsCell(registry: DockerRegistry)}
	<ResourceRowActions
		label={`Actions for ${registry.name}`}
		actions={rowActions(registry)}
	/>
{/snippet}

<ResourceDataTable
	caption="Registries"
	{columns}
	data={registries}
	getRowId={(registry) => registry.id}
	rowLabel={(registry) => registry.name}
	{sortConfig}
	sortedByServer
	{pagination}
	{footer}
	{isLoading}
	errorMessage={isError ? "Couldn't load registries" : undefined}
	{onRetry}
	{empty}
	selectedRowId={openRegistryId}
	onRowClick={onOpen}
	rowContextMenu
/>
