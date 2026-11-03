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
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';

export const SECRET_COLUMN_LABELS = [
	'Name',
	'Description',
	'Version',
	'Updated',
	'Created',
];

interface SecretsTableProps {
	secrets: readonly SecretDto[];
	isError: boolean;
	onRetry: () => void;
	onOpen: (secretId: string) => void;
	rowActions: (secret: SecretDto) => readonly ResourceRowAction[];
	empty: Snippet;
}
</script>

<script lang="ts">
import Key from '@lucide/svelte/icons/key';
import { renderSnippet } from '@tanstack/svelte-table';
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

let {
	secrets,
	isError,
	onRetry,
	onOpen,
	rowActions,
	empty,
}: SecretsTableProps = $props();

const column = resourceColumnHelper<SecretDto>();
const columns: ResourceColumnDefs<SecretDto> = [
	column.accessor('name', {
		header: 'Name',
		cell: ({ row }) =>
			resourceCell(
				{ icon: secretIcon, label: row.original.name },
				row.original
			),
	}),
	column.accessor('description', {
		header: 'Description',
		cell: ({ getValue }) => resourceTextCell({ label: getValue() }),
	}),
	column.accessor('currentVersion', {
		id: 'version',
		header: 'Version',
		cell: ({ getValue }) => resourceTextCell({ label: `v${getValue()}` }),
	}),
	column.accessor('updatedAt', {
		id: 'updated',
		header: 'Updated',
		cell: ({ getValue }) => resourceTextCell(timeCell(getValue())),
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

{#snippet secretIcon()}
	<Key />
{/snippet}

{#snippet actionsCell(
	secret: SecretDto
)}
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
	errorMessage={isError ? 'Failed to load secrets' : undefined}
	{onRetry}
	{empty}
	onRowClick={onOpen}
/>
