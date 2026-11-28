<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ChipModalConfirmTarget from '#lib/components/ui/chip-modal/chip-modal-confirm-target.svelte';
import CreateSecretModal from '#lib/features/secrets/components/create-secret-modal.svelte';
import EditSecretModal from '#lib/features/secrets/components/edit-secret-modal.svelte';
import SecretVersionModal from '#lib/features/secrets/components/secret-version-modal.svelte';
import { deleteSecretCopy } from '#lib/features/secrets/lib/secret-confirm-copy.ts';
import type { SecretsList } from '#lib/features/secrets/state/secrets-list.svelte.ts';

let { list }: { list: SecretsList } = $props();
</script>

<CreateSecretModal bind:open={list.createOpen} />

{#if list.editing}
	{#key list.editing.id}
		<EditSecretModal
			secret={list.editing}
			onClose={() => (list.editing = null)}
		/>
	{/key}
{/if}

<SecretVersionModal
	secret={list.rotating}
	onClose={() => (list.rotating = null)}
/>

<ChipModalConfirmTarget
	target={list.deleting}
	{...deleteSecretCopy(list.deleting)}
	friction="type-name"
	confirmName={list.deleting?.name}
	pending={list.deleteMutation.isPending}
	error={list.deleteMutation.error?.message}
	onCancel={list.cancelDelete}
	onConfirm={list.remove}
/>
