<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { PlacementKind } from '@snapflow/api-client';

const MOVE_TABS = [
	{ label: 'Best match', value: PlacementKind.Flexible },
	{ label: 'Specific machine', value: PlacementKind.Pinned },
];
const INVALID_PRICE_MESSAGE =
	'Use a USD amount with at most six decimal places';
</script>

<script lang="ts">
import type { MoveSandbox } from '@snapflow/api-client';
import ChipDropdown from '#lib/components/ui/chip/chip-dropdown.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import ChipModalTabs from '#lib/components/ui/chip-modal/chip-modal-tabs.svelte';
import type { PlacementError } from '#lib/features/sandboxes/lib/placement-errors.ts';
import { PlacementMachines } from '#lib/features/sandboxes/state/placement-machines.svelte.ts';
import { usdInputToMicroUsd } from '#lib/utils/usd.ts';
import SandboxPlacementErrorNotice from './sandbox-placement-error-notice.svelte';

interface SandboxMoveModalProps {
	failure: PlacementError | null;
	onMove: (move: MoveSandbox) => void;
	onOpenChange?: (open: boolean) => void;
	open?: boolean;
	pending: boolean;
}

let {
	failure,
	onMove,
	onOpenChange,
	open = $bindable(false),
	pending,
}: SandboxMoveModalProps = $props();

const fieldId = $props.id();
const machineFieldId = `${fieldId}-machine`;
const maxPriceFieldId = `${fieldId}-max-price`;

let target = $state<PlacementKind>(PlacementKind.Flexible);
let machineId = $state('');
let maxPrice = $state('');
const placementMachines = new PlacementMachines(() => ({
	enabled: open && target === PlacementKind.Pinned,
	selectedMachineId: machineId,
}));
const maxHourlyPriceMicroUsd = $derived(usdInputToMicroUsd(maxPrice));
const priceInvalid = $derived(
	maxPrice.trim() !== '' && !maxHourlyPriceMicroUsd
);
const machineMissing = $derived(target === PlacementKind.Pinned && !machineId);

function submit(): void {
	onMove({
		machineId: target === PlacementKind.Pinned ? machineId : undefined,
		maxHourlyPriceMicroUsd: maxHourlyPriceMicroUsd ?? undefined,
	});
}
</script>

<ChipModal bind:open {onOpenChange} onsubmit={submit} srTitle="Move sandbox">
	<ChipModalHeader>Move sandbox</ChipModalHeader>
	<ChipModalBody>
		<div class="px-2">
			<ChipModalTabs
				aria-label="Move target"
				tabs={MOVE_TABS}
				value={target}
				onChange={(value) => {
					target =
						value === PlacementKind.Pinned
							? PlacementKind.Pinned
							: PlacementKind.Flexible;
				}}
			/>
		</div>
		<p class="px-2 text-(--text-primary) text-sm">
			The sandbox stops, its backup is restored on the new machine, and a new
			lease starts at that machine’s current price.
		</p>
		{#if target === PlacementKind.Pinned}
			<ChipModalField label="Machine" for={machineFieldId} required>
				<ChipDropdown
					id={machineFieldId}
					fullWidth
					align="start"
					options={placementMachines.options}
					placeholder="Select a machine"
					bind:value={machineId}
				/>
			</ChipModalField>
		{/if}
		<ChipModalField
			label="Max price per hour"
			for={maxPriceFieldId}
			hint="USD. Leave empty to keep the current locked price."
			error={priceInvalid ? INVALID_PRICE_MESSAGE : null}
		>
			<ChipInput
				id={maxPriceFieldId}
				inputmode="decimal"
				placeholder="0.00"
				error={priceInvalid}
				bind:value={maxPrice}
			/>
		</ChipModalField>
		{#if failure}
			<div class="px-2">
				<SandboxPlacementErrorNotice
					error={failure}
					onUseMachine={(alternative) => {
						target = PlacementKind.Pinned;
						machineId = alternative.machineId;
					}}
				/>
			</div>
		{/if}
	</ChipModalBody>
	<ChipModalFooter cancelDisabled={pending}>
		{#snippet primaryAction(
			initialFocus
		)}
			<ChipModalAction
				type="submit"
				variant="primary"
				disabled={pending || priceInvalid || machineMissing}
				{@attach initialFocus}
			>
				{pending ? 'Moving...' : 'Move'}
			</ChipModalAction>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
