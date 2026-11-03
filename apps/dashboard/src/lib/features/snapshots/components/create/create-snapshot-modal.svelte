<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ChipModalWizard from '#lib/components/ui/chip-modal/chip-modal-wizard.svelte';
import { CREATE_SNAPSHOT_STEPS } from '#lib/features/snapshots/lib/create-snapshot-form.ts';
import {
	CreateSnapshotWizard,
	type CreateSnapshotWizardOptions,
} from '#lib/features/snapshots/state/create-snapshot-wizard.svelte.ts';
import CreateSnapshotReviewStep from './create-snapshot-review-step.svelte';
import CreateSnapshotRuntimeStep from './create-snapshot-runtime-step.svelte';
import CreateSnapshotSourceStep from './create-snapshot-source-step.svelte';

interface CreateSnapshotModalProps extends CreateSnapshotWizardOptions {
	open?: boolean;
}

let {
	open = $bindable(false),
	limits,
	onCreate,
	usage,
}: CreateSnapshotModalProps = $props();

const wizard = new CreateSnapshotWizard(() => ({
	limits,
	onCreate,
	usage,
}));
const form = wizard.form;
const isSubmitting = form.useSelector((state) => state.isSubmitting);
</script>

<ChipModalWizard
	bind:open
	onOpenChange={(nextOpen) => {
		if (!nextOpen) wizard.reset();
	}}
	steps={CREATE_SNAPSHOT_STEPS}
	bind:step={() => wizard.step, wizard.requestStep}
	pending={isSubmitting.current && wizard.isLastStep}
	completeLabel="Create"
	pendingLabel="Creating..."
	onComplete={wizard.complete}
>
	{#snippet children(
		step
	)}
		<div bind:this={wizard.fieldsElement} class="flex flex-col gap-4">
			{#if CREATE_SNAPSHOT_STEPS[step]?.key === 'source'}
				<CreateSnapshotSourceStep
					{form}
					sandboxClassOptions={wizard.sandboxClassOptions}
				/>
			{:else if CREATE_SNAPSHOT_STEPS[step]?.key === 'runtime'}
				<CreateSnapshotRuntimeStep
					{form}
					gpuAvailable={wizard.gpuAvailable}
					gpuOptions={wizard.gpuOptions}
				/>
			{:else}
				<CreateSnapshotReviewStep
					classLabel={wizard.selectedClassLabel}
					values={wizard.values}
				/>
			{/if}
		</div>
	{/snippet}
</ChipModalWizard>
