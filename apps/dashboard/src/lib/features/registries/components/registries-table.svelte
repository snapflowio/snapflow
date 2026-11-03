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
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';

const URL_COLUMN_WIDTH = 1.3;

export const REGISTRY_COLUMN_LABELS = [
	'Name',
	'URL',
	'Username',
	'Type',
	'Created',
];

interface RegistriesTableProps {
	registries: readonly DockerRegistry[];
	isError: boolean;
	onRetry: () => void;
	onOpen: (registryId: string) => void;
	rowActions: (registry: DockerRegistry) => readonly ResourceRowAction[];
	empty: Snippet;
}
</script>

<script lang="ts">
import { renderSnippet } from '@tanstack/svelte-table';
import HexSimple from '#lib/components/icons/hex-simple.svelte';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
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
import Badge from '#lib/components/ui/badge.svelte';
import {
	ORGANIZATION_REGISTRY_TYPE,
	registryTypeLabel,
} from '#lib/features/registries/lib/registries-list.ts';

let {
	registries,
	isError,
	onRetry,
	onOpen,
	rowActions,
	empty,
}: RegistriesTableProps = $props();

const column = resourceColumnHelper<DockerRegistry>();
const columns: ResourceColumnDefs<DockerRegistry> = [
	column.accessor('name', {
		header: 'Name',
		cell: ({ row }) =>
			resourceCell(
				{ icon: registryIcon, label: row.original.name },
				row.original
			),
	}),
	column.accessor('url', {
		header: 'URL',
		meta: { widthMultiplier: URL_COLUMN_WIDTH },
		cell: ({ getValue }) => resourceTextCell({ label: getValue() }),
	}),
	column.accessor('username', {
		header: 'Username',
		cell: ({ getValue }) => resourceTextCell({ label: getValue() }),
	}),
	column.accessor('registryType', {
		id: 'type',
		header: 'Type',
		cell: ({ row }) => renderSnippet(typeBadge, row.original),
	}),
	column.accessor('createdAt', {
		id: 'created',
		header: 'Created',
		cell: ({ getValue }) => resourceTextCell(timeCell(getValue())),
	}),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions' },
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	}),
];
</script>

{#snippet registryIcon()}
	<HexSimple />
{/snippet}

{#snippet typeBadge(
	registry: DockerRegistry
)}
	<Badge
		size="sm"
		variant={registry.registryType === ORGANIZATION_REGISTRY_TYPE
			? 'blue'
			: 'gray-secondary'}
	>
		{registryTypeLabel(registry.registryType)}
	</Badge>
{/snippet}

{#snippet actionsCell(
	registry: DockerRegistry
)}
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
	errorMessage={isError ? 'Failed to load registries' : undefined}
	{onRetry}
	{empty}
	onRowClick={onOpen}
/>
