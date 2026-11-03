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
import CreateRegistryModal from '#lib/features/registries/components/create-registry-modal.svelte';
import { deleteRegistryCopy } from '#lib/features/registries/lib/registry-confirm-copy.ts';
import type { RegistriesList } from '#lib/features/registries/state/registries-list.svelte.ts';

let { list }: { list: RegistriesList } = $props();
</script>

<CreateRegistryModal bind:open={list.createOpen} />

<ChipModalConfirmTarget
	target={list.deleting}
	{...deleteRegistryCopy(list.deleting)}
	pending={list.deleteMutation.isPending}
	onCancel={() => (list.deleting = null)}
	onConfirm={list.remove}
/>
