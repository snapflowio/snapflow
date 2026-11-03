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
import CreateSnapshotModal from '#lib/features/snapshots/components/create/create-snapshot-modal.svelte';
import {
	deleteSnapshotCopy,
	deleteSnapshotsCopy,
} from '#lib/features/snapshots/lib/snapshot-confirm-copy.ts';
import type { SnapshotsList } from '#lib/features/snapshots/state/snapshots-list.svelte.ts';

let { list }: { list: SnapshotsList } = $props();
</script>

{#if list.limitsQuery.data}
	<CreateSnapshotModal
		bind:open={list.createOpen}
		onCreate={list.create}
		limits={list.limitsQuery.data}
		usage={list.usageQuery.data}
	/>
{/if}

<ChipModalConfirmTarget
	target={list.bulkDeleteTarget}
	{...deleteSnapshotsCopy(list.selection.selected)}
	pending={list.bulkDeleteMutation.isPending}
	onCancel={() => (list.bulkDeleteOpen = false)}
	onConfirm={list.removeSelected}
/>

<ChipModalConfirmTarget
	target={list.deleting}
	{...deleteSnapshotCopy(list.deleting)}
	pending={list.deleteMutation.isPending}
	onCancel={() => (list.deleting = null)}
	onConfirm={list.remove}
/>
