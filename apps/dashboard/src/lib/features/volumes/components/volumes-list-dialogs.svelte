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
import CreateVolumeModal from '#lib/features/volumes/components/create-volume-modal.svelte';
import {
	deleteVolumeCopy,
	deleteVolumesCopy,
} from '#lib/features/volumes/lib/volume-confirm-copy.ts';
import type { VolumesList } from '#lib/features/volumes/state/volumes-list.svelte.ts';

let { list }: { list: VolumesList } = $props();
</script>

<CreateVolumeModal bind:open={list.createOpen} />

<ChipModalConfirmTarget
	target={list.bulkDeleteTarget}
	{...deleteVolumesCopy(list.selection.selected)}
	pending={list.bulkDeleteMutation.isPending}
	onCancel={() => (list.bulkDeleteOpen = false)}
	onConfirm={list.removeSelected}
/>

<ChipModalConfirmTarget
	target={list.deleting}
	{...deleteVolumeCopy(list.deleting)}
	pending={list.deleteMutation.isPending}
	onCancel={() => (list.deleting = null)}
	onConfirm={list.remove}
/>
