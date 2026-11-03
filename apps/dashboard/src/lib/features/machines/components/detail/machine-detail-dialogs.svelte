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
import {
	deleteMachineCopy,
	drainMachineCopy,
	revokeMachineCopy,
} from '#lib/features/machines/lib/machine-confirm-copy.ts';
import { getMachineDetail } from '#lib/features/machines/state/machine-detail.svelte.ts';

const detail = getMachineDetail();
const machine = $derived(detail.query.data ?? null);
const draining = $derived(detail.confirming === 'drain' ? machine : null);
const revoking = $derived(detail.confirming === 'revoke' ? machine : null);
const deleting = $derived(detail.confirming === 'delete' ? machine : null);
</script>

<ChipModalConfirmTarget
	target={draining}
	{...drainMachineCopy(draining)}
	pending={detail.draining.isPending}
	onCancel={detail.cancelConfirm}
	onConfirm={() => detail.setDraining(true)}
/>
<ChipModalConfirmTarget
	target={revoking}
	{...revokeMachineCopy(revoking)}
	pending={detail.revoke.isPending}
	onCancel={detail.cancelConfirm}
	onConfirm={detail.revokeIdentity}
/>
<ChipModalConfirmTarget
	target={deleting}
	{...deleteMachineCopy(deleting)}
	pending={detail.remove.isPending}
	onCancel={detail.cancelConfirm}
	onConfirm={detail.deleteMachine}
/>
