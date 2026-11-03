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
import { deleteSecretCopy } from '#lib/features/secrets/lib/secret-confirm-copy.ts';
import type { SecretsList } from '#lib/features/secrets/state/secrets-list.svelte.ts';

let { list }: { list: SecretsList } = $props();
</script>

<CreateSecretModal bind:open={list.createOpen} />

<ChipModalConfirmTarget
	target={list.deleting}
	{...deleteSecretCopy(list.deleting)}
	pending={list.deleteMutation.isPending}
	onCancel={() => (list.deleting = null)}
	onConfirm={list.remove}
/>
