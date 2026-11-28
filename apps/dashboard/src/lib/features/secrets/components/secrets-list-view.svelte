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
import ResourceHeader, {
	type ResourceCreateAction,
} from '#lib/components/resource/resource-header.svelte';
import ResourceListEmpty from '#lib/components/resource/resource-list-empty.svelte';
import ResourceRowContextMenu from '#lib/components/resource/resource-row-context-menu.svelte';
import SecretDetailsPanel from '#lib/features/secrets/components/secret-details-panel.svelte';
import SecretsListDialogs from '#lib/features/secrets/components/secrets-list-dialogs.svelte';
import SecretsTable from '#lib/features/secrets/components/secrets-table.svelte';
import { SECRET_SEARCH_PLACEHOLDER } from '#lib/features/secrets/lib/secrets-list.ts';
import { SecretsList } from '#lib/features/secrets/state/secrets-list.svelte.ts';
import { pluralize } from '#lib/utils/text.ts';

const list = new SecretsList();
const create = $derived<ResourceCreateAction>({
	label: 'New secret',
	onSelect: list.openCreate,
	disabled: !list.canWrite,
	disabledReason: 'You need secret write access',
});
</script>

{#snippet emptyState()}
	<ResourceListEmpty
		icon={Key}
		message="No secrets yet"
		description="Secrets inject encrypted values into your sandboxes."
		{create}
		search={list.search.value}
		resource="secrets"
		onClear={list.clearSearch}
	/>
{/snippet}

<Resource>
	<ResourceHeader
		title="Secrets"
		search={{
			value: list.search.value,
			onChange: (value) => (list.search.value = value),
			placeholder: SECRET_SEARCH_PLACEHOLDER,
			ariaLabel: 'Search secrets',
		}}
		sort={list.sortConfig}
		{create}
	/>
	<ResourceRowContextMenu actionsFor={list.contextActions}>
		<SecretsTable
			secrets={list.pagination.rows}
			isLoading={list.secretsQuery.isPending}
			isError={list.secretsQuery.isError}
			onRetry={() => void list.secretsQuery.refetch()}
			openSecretId={list.panel.openId}
			onOpen={list.panel.open}
			rowActions={list.rowActions}
			sortConfig={list.sortConfig}
			pagination={list.pagination.config}
			footer={pluralize(list.secrets.length, 'secret')}
			empty={emptyState}
		/>
	</ResourceRowContextMenu>
	<SecretDetailsPanel
		open={list.panel.row !== null}
		secret={list.panelSecret}
		actions={list.panelSecret ? list.rowActions(list.panelSecret) : []}
		onClose={list.panel.close}
		onPrevious={list.panel.previous}
		onNext={list.panel.next}
	/>
</Resource>

<SecretsListDialogs {list} />
