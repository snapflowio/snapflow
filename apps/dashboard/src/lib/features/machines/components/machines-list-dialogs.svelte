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
import AddMachineModal from '#lib/features/machines/components/add-machine-modal.svelte';
import {
	deleteMachineCopy,
	deleteMachinesCopy,
	drainMachineCopy,
	revokeMachineCopy,
} from '#lib/features/machines/lib/machine-confirm-copy.ts';
import type { MachinesList } from '#lib/features/machines/state/machines-list.svelte.ts';

let { list }: { list: MachinesList } = $props();
</script>

<AddMachineModal bind:open={list.addOpen} />
<ChipModalConfirmTarget
	target={list.startingDrain}
	{...drainMachineCopy(list.startingDrain)}
	pending={list.drainingMutation.isPending}
	onCancel={() => (list.startingDrain = null)}
	onConfirm={(machine) => list.setDraining(machine, true)}
/>
<ChipModalConfirmTarget
	target={list.revoking}
	{...revokeMachineCopy(list.revoking)}
	pending={list.revokeMutation.isPending}
	onCancel={() => (list.revoking = null)}
	onConfirm={list.revokeIdentity}
/>
<ChipModalConfirmTarget
	target={list.deleting}
	{...deleteMachineCopy(list.deleting)}
	pending={list.deleteMutation.isPending}
	onCancel={() => (list.deleting = null)}
	onConfirm={(machine) => void list.deleteMachines([machine])}
/>
<ChipModalConfirmTarget
	target={list.bulkDeleting.length > 0 ? list.bulkDeleting : null}
	{...deleteMachinesCopy(list.bulkDeleting)}
	pending={list.deleteMutation.isPending}
	onCancel={() => (list.bulkDeleting = [])}
	onConfirm={(targets) => void list.deleteMachines(targets)}
/>
