<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Key from '@lucide/svelte/icons/key';
import Resource from '#lib/components/resource/resource.svelte';
import ResourceChromeFallback from '#lib/components/resource/resource-chrome-fallback.svelte';
import ResourceHeader from '#lib/components/resource/resource-header.svelte';
import ResourceListEmpty from '#lib/components/resource/resource-list-empty.svelte';
import ResourceOptionsBar from '#lib/components/resource/resource-options-bar.svelte';
import ResourceRowContextMenu from '#lib/components/resource/resource-row-context-menu.svelte';
import SecretsListDialogs from '#lib/features/secrets/components/secrets-list-dialogs.svelte';
import SecretsTable, {
	SECRET_COLUMN_LABELS,
} from '#lib/features/secrets/components/secrets-table.svelte';
import { SecretsList } from '#lib/features/secrets/state/secrets-list.svelte.ts';

const list = new SecretsList();
</script>

{#snippet emptyState()}
	<ResourceListEmpty
		title="Secrets"
		description="Store credentials once and bind them to sandboxes as environment variables."
		create={{
			label: 'New secret',
			onSelect: list.openCreate,
			disabled: !list.canWrite,
		}}
		search={list.search.value}
		onClear={list.clearSearch}
	/>
{/snippet}

{#if list.secretsQuery.isPending}
	<ResourceChromeFallback
		icon={Key}
		title="Secrets"
		createLabel="New secret"
		searchPlaceholder="Search secrets..."
		columns={SECRET_COLUMN_LABELS}
	/>
{:else}
	<Resource>
		<ResourceHeader
			icon={Key}
			title="Secrets"
			create={{
				label: 'New secret',
				onSelect: list.openCreate,
				disabled: !list.canWrite,
			}}
		/>
		<ResourceOptionsBar
			search={{
				value: list.search.value,
				onChange: (value) => (list.search.value = value),
				placeholder: 'Search secrets...',
			}}
			sort={list.sortConfig}
		/>
		<ResourceRowContextMenu actionsFor={list.contextActions}>
			<SecretsTable
				secrets={list.secrets}
				isError={list.secretsQuery.isError}
				onRetry={() => void list.secretsQuery.refetch()}
				onOpen={list.openSecret}
				rowActions={list.rowActions}
				empty={emptyState}
			/>
		</ResourceRowContextMenu>
	</Resource>
{/if}

<SecretsListDialogs {list} />
