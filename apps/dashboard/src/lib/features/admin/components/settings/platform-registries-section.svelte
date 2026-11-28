<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Copy from '@lucide/svelte/icons/copy';
import Pencil from '@lucide/svelte/icons/pencil';
import Plus from '@lucide/svelte/icons/plus';
import type { DockerRegistry } from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	deletePlatformRegistryMutationOptions,
	platformRegistriesQueryOptions,
	updatePlatformRegistryMutationOptions,
} from '#lib/api/admin/platform-settings.ts';
import HexSimple from '#lib/components/icons/hex-simple.svelte';
import Trash from '#lib/components/icons/trash.svelte';
import QueryFeedbackState from '#lib/components/query-feedback-state.svelte';
import SettingsResourceRow from '#lib/components/settings/settings-resource-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import { copyId } from '#lib/features/admin/lib/admin-list.ts';
import { adminLoadErrorMessage } from '#lib/features/admin/lib/admin-load-error.ts';
import SettingsGroupCell from '#lib/features/organizations/components/settings/settings-group-cell.svelte';
import EditRegistryModal from '#lib/features/registries/components/edit-registry-modal.svelte';
import CreatePlatformRegistryModal from './create-platform-registry-modal.svelte';

const registriesQuery = createQuery(() => platformRegistriesQueryOptions());
let creating = $state(false);
let editing = $state.raw<DockerRegistry | null>(null);
let deleting = $state.raw<DockerRegistry | null>(null);
const update = createMutation(() => updatePlatformRegistryMutationOptions());
const remove = createMutation(() => deletePlatformRegistryMutationOptions());
const registries = $derived(registriesQuery.data);

function confirmDelete() {
	if (!deleting) return;
	remove.mutate(deleting, {
		onSuccess: () => {
			deleting = null;
		},
	});
}
</script>

<SettingsSection
	title="Platform registries"
	description="Credentials the platform pulls public images with, such as a Docker Hub account."
>
	{#if !registries}
		<QueryFeedbackState
			errorMessage={adminLoadErrorMessage(
				registriesQuery.error,
				'platform registries'
			)}
			loadingMessage="Loading platform registries"
			query={registriesQuery}
		/>
	{:else}
		{#each registries as registry (registry.id)}
			<SettingsResourceRow
				title={registry.name}
				meta={registry.url}
				icon={HexSimple}
				actionsLabel={`${registry.name} actions`}
				actions={[
					{
						icon: Pencil,
						label: 'Edit',
						onSelect: () => {
							editing = registry;
						},
					},
					{
						icon: Copy,
						label: 'Copy ID',
						onSelect: () => copyId(registry.id),
					},
					{
						icon: Trash,
						label: 'Delete',
						destructive: true,
						onSelect: () => {
							deleting = registry;
						},
					},
				]}
			/>
		{:else}
			<SettingsGroupCell tone="muted"
				>No platform registries yet.</SettingsGroupCell
			>
		{/each}
		<SettingsGroupCell>
			<Chip
				variant="secondary"
				size="compact"
				leftIcon={Plus}
				onclick={() => {
					creating = true;
				}}
			>
				Add registry
			</Chip>
		</SettingsGroupCell>
	{/if}
</SettingsSection>
<CreatePlatformRegistryModal bind:open={creating} />
<EditRegistryModal
	bind:open={
		() => editing !== null,
		(open) => {
	if (!open) editing = null;
}
	}
	registry={editing}
	loading={update.isPending}
	onEditRegistry={async (changes) => {
		if (editing) {
			update.mutate(
				{ changes, registry: editing },
				{
					onSuccess: () => {
						editing = null;
					},
				}
			);
		}
	}}
/>
<ChipModalConfirm
	bind:open={
		() => deleting !== null,
		(open) => {
	if (!open) deleting = null;
}
	}
	title="Delete registry"
	text={[
		'Are you sure you want to delete ',
		{ text: deleting?.name ?? 'this registry', bold: true },
		'? ',
		{
			text: 'Images from this registry are pulled without credentials afterwards.',
			error: true,
		},
	]}
	pending={remove.isPending}
	onsubmit={confirmDelete}
>
	{#snippet confirm()}
		<Chip
			loading={remove.isPending}
			type="submit"
			variant="destructive"
			disabled={remove.isPending}
		>
			Delete
		</Chip>
	{/snippet}
</ChipModalConfirm>
