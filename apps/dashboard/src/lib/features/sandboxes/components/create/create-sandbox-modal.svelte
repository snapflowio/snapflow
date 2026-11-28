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
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
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
	presetSnapshot,
	snapshots,
	usage,
}: CreateSandboxModalProps = $props();

const wizard = new CreateSandboxWizard(() => ({
	close,
	limits,
	locations,
	open,
	pinnedMachineId,
	presetSnapshot,
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

let discardOpen = $state(false);

function close(): void {
	open = false;
	onOpenChange?.(false);
}

function discard(): void {
	discardOpen = false;
	close();
	wizard.reset();
}

function changeOpen(next: boolean): void {
	if (next) {
		open = true;
		onOpenChange?.(true);
	} else if (wizard.hasDraft) {
		discardOpen = true;
	} else {
		discard();
	}
}
</script>

<ChipModal
	bind:open={() => open, changeOpen}
	onsubmit={wizard.submit}
	srTitle={wizard.currentStep.label}
	variant="sheet"
>
	<ChipModalHeader onClose={() => changeOpen(false)}>
		{wizard.currentStep.label}
		{#snippet actions()}
			<span
				class="mr-2 whitespace-nowrap text-(--text-muted) text-xs tabular-nums"
			>
				<span class="max-sm:hidden">{wizard.stepLabel}</span>
				<span class="sm:hidden">{wizard.stepShortLabel}</span>
			</span>
		{/snippet}
	</ChipModalHeader>
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
				onWholeMachineChange={wizard.rentWholeMachine}
				placementError={wizard.placementFailure}
				quote={wizard.shownQuote}
				values={wizard.values}
			/>
		{/if}
	</ChipModalBody>
	<form.Subscribe selector={(state) => state.isSubmitting}>
		{#snippet children(isSubmitting)}
			<ChipModalFooter hideCancel>
				{#snippet leadingContent()}
					{#if wizard.isFirstStep}
						<Chip
							disabled={isSubmitting}
							onclick={(event) => wizard.skipToReview(event.currentTarget.form)}
						>
							Review with defaults
						</Chip>
					{/if}
				{/snippet}
				{#snippet primaryAdjacentAction()}
					<Chip
						disabled={wizard.isFirstStep || isSubmitting}
						onclick={wizard.goBack}
					>
						Back
					</Chip>
				{/snippet}
				{#snippet primaryAction(initialFocus)}
					<Chip
						type="submit"
						variant="primary"
						loading={isSubmitting}
						{@attach initialFocus}
					>
						{wizard.isLastStep ? 'Create' : 'Next'}
					</Chip>
				{/snippet}
			</ChipModalFooter>
		{/snippet}
	</form.Subscribe>
</ChipModal>

<ChipModalConfirm
	bind:open={discardOpen}
	onsubmit={discard}
	title="Discard sandbox draft"
	text="The settings you entered for this sandbox will be lost."
	cancelLabel="Keep editing"
>
	{#snippet confirm()}
		<Chip type="submit" variant="destructive">Discard</Chip>
	{/snippet}
</ChipModalConfirm>
