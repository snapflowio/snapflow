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
import Trash from '@lucide/svelte/icons/trash-2';
import type { DockerRegistry } from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	deletePlatformRegistryMutationOptions,
	platformRegistriesQueryOptions,
	updatePlatformRegistryMutationOptions,
} from '#lib/api/admin/platform-settings.ts';
import FeedbackState from '#lib/components/feedback-state.svelte';
import HexSimple from '#lib/components/icons/hex-simple.svelte';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import SettingsResourceRow from '#lib/components/settings/settings-resource-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import AdminQueryFeedback from '#lib/features/admin/components/admin-query-feedback.svelte';
import { copyId } from '#lib/features/admin/lib/admin-list.ts';
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

{#snippet addRegistry()}
	<Chip
		onclick={() => {
			creating = true;
		}}
	>
		Add registry
	</Chip>
{/snippet}

<SettingsSection
	title="Platform registries"
	description="Credentials the platform pulls public images with, such as a Docker Hub account. Snapshot images, backups and build caches use the platform snapshot manager."
	action={addRegistry}
>
	{#if !registries}
		<AdminQueryFeedback
			errorMessage="Failed to load platform registries"
			loadingMessage="Loading platform registries..."
			query={registriesQuery}
		/>
	{:else if registries.length === 0}
		<FeedbackState
			class="min-h-0 py-4"
			message="Click “Add registry” above to get started."
		/>
	{:else}
		<div class="flex flex-col gap-y-0.5">
			{#each registries as registry (registry.id)}
				<div class="group/row-actions">
					<SettingsResourceRow
						title={registry.name}
						description={registry.url}
						icon={HexSimple}
					>
						{#snippet trailing()}
							<ResourceRowActions
								label={`${registry.name} actions`}
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
										onSelect: () => {
											deleting = registry;
										},
										separated: true,
									},
								]}
							/>
						{/snippet}
					</SettingsResourceRow>
				</div>
			{/each}
		</div>
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
		<ChipModalAction
			type="submit"
			variant="destructive"
			disabled={remove.isPending}
		>
			{remove.isPending ? 'Deleting...' : 'Delete'}
		</ChipModalAction>
	{/snippet}
</ChipModalConfirm>
