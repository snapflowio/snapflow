<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->
<script lang="ts" module>
const CREATE_SANDBOX_DRAFT_SNAPSHOT_ID = 'create-sandbox-wizard';
</script>

<script lang="ts">
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import { CHIP_MODAL_WIZARD_HEIGHT_CLASS } from '#lib/components/ui/chip-modal/chip-modal-wizard-styles.ts';
import {
	type CreateSandboxDraft,
	CreateSandboxWizard,
	type CreateSandboxWizardOptions,
} from '#lib/features/sandboxes/state/create-sandbox-wizard.svelte.ts';
import { snapshot } from '$app/navigation';
import CreateSandboxBasicsStep from './create-sandbox-basics-step.svelte';
import CreateSandboxEnvironmentStep from './create-sandbox-environment-step.svelte';
import CreateSandboxLifecycleStep from './create-sandbox-lifecycle-step.svelte';
import CreateSandboxReviewStep from './create-sandbox-review-step.svelte';

interface CreateSandboxModalProps
	extends Omit<CreateSandboxWizardOptions, 'close' | 'open'> {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

let {
	limits,
	locations,
	onOpenChange,
	open = $bindable(false),
	pinnedMachineId,
	snapshots,
	usage,
}: CreateSandboxModalProps = $props();

const wizard = new CreateSandboxWizard(() => ({
	close,
	limits,
	locations,
	open,
	pinnedMachineId,
	snapshots,
	usage,
}));
const form = wizard.form;

snapshot<CreateSandboxDraft | null>({
	id: CREATE_SANDBOX_DRAFT_SNAPSHOT_ID,
	capture: () => (open ? wizard.captureDraft() : null),
	restore: (draft) => {
		if (!draft) return;
		wizard.restoreDraft(draft);
		open = true;
	},
});

function close(): void {
	open = false;
	onOpenChange?.(false);
}

function handleOpenChange(next: boolean): void {
	onOpenChange?.(next);
	if (!next) wizard.reset();
}

function dismiss(): void {
	close();
	wizard.reset();
}
</script>

<ChipModal
	bind:open
	onOpenChange={handleOpenChange}
	onsubmit={wizard.submit}
	srTitle={wizard.currentStep.label}
	size="lg"
	class={CHIP_MODAL_WIZARD_HEIGHT_CLASS}
>
	<ChipModalHeader onClose={dismiss}
		>{wizard.currentStep.label}</ChipModalHeader
	>
	<ChipModalBody>
		{#if wizard.currentStep.key === 'workload'}
			<CreateSandboxBasicsStep
				availableSnapshots={wizard.availableSnapshots}
				callerLocation={wizard.callerLocation}
				{form}
				gpu={wizard.values.gpu}
				gpuAvailable={wizard.gpuAvailable}
				gpuOptions={wizard.gpuOptions}
				locationOptions={wizard.locationOptions}
				{open}
				selectedSnapshot={wizard.selectedSnapshot}
				selectedSource={wizard.values.source}
			/>
		{:else if wizard.currentStep.key === 'runtime'}
			<CreateSandboxLifecycleStep
				{form}
				gpu={wizard.values.gpu}
				mode={wizard.values.mode}
			/>
		{:else if wizard.currentStep.key === 'configuration'}
			<CreateSandboxEnvironmentStep
				availableVolumes={wizard.availableVolumes}
				{form}
				secrets={wizard.secrets}
			/>
		{:else}
			<CreateSandboxReviewStep
				onUseMachine={wizard.useMachine}
				placementError={wizard.placementFailure}
				quote={wizard.shownQuote}
				values={wizard.values}
			/>
		{/if}
	</ChipModalBody>
	<form.Subscribe selector={(state) => state.isSubmitting}>
		{#snippet children(
			isSubmitting
		)}
			<ChipModalFooter hideCancel>
				{#snippet primaryAdjacentAction()}
					<Chip
						disabled={wizard.isFirstStep || isSubmitting}
						onclick={wizard.goBack}
					>
						Back
					</Chip>
				{/snippet}
				{#snippet primaryAction(
					initialFocus
				)}
					<ChipModalAction
						type="submit"
						variant="primary"
						disabled={isSubmitting}
						aria-busy={isSubmitting || undefined}
						{@attach initialFocus}
					>
						{#if !wizard.isLastStep}
							Next
						{:else if isSubmitting}
							Creating...
						{:else}
							Create
						{/if}
					</ChipModalAction>
				{/snippet}
			</ChipModalFooter>
		{/snippet}
	</form.Subscribe>
</ChipModal>
