<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { WhenMachineUnavailable } from '@snapflow/api-client';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import type { PlacementError } from '#lib/features/sandboxes/lib/placement-errors.ts';
import SandboxPlacementErrorNotice from './sandbox-placement-error-notice.svelte';

interface SandboxStartChoiceModalProps {
	failure: PlacementError | null;
	onChoose: (choice: WhenMachineUnavailable) => void;
	onOpenChange?: (open: boolean) => void;
	open?: boolean;
	pending: boolean;
}

let {
	failure,
	onChoose,
	onOpenChange,
	open = $bindable(false),
	pending,
}: SandboxStartChoiceModalProps = $props();
</script>

<ChipModal
	bind:open
	{onOpenChange}
	onsubmit={() => onChoose(WhenMachineUnavailable.Move)}
	srTitle="Pinned machine unavailable"
>
	<ChipModalHeader>Pinned machine unavailable</ChipModalHeader>
	<ChipModalBody>
		{#if failure}
			<div class="px-2">
				<SandboxPlacementErrorNotice error={failure} />
			</div>
		{/if}
		<p class="px-2 text-(--text-primary) text-sm">
			Wait for capacity on this machine, or move the sandbox: its backup is
			restored on the best matching machine in the same category, near the
			previous machine, under a new lease.
		</p>
	</ChipModalBody>
	<ChipModalFooter cancelDisabled={pending}>
		{#snippet primaryAdjacentAction()}
			<Chip
				disabled={pending}
				onclick={() => onChoose(WhenMachineUnavailable.Wait)}
			>
				Wait
			</Chip>
		{/snippet}
		{#snippet primaryAction(
			initialFocus
		)}
			<ChipModalAction
				type="submit"
				variant="primary"
				disabled={pending}
				{@attach initialFocus}
			>
				{pending ? 'Starting...' : 'Move and start'}
			</ChipModalAction>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
