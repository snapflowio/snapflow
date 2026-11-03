<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { ChipOption } from '#lib/components/ui/chip/chip-selection.ts';
import {
	DEFAULT_CPU,
	DEFAULT_MEMORY_GIB,
	DEFAULT_STORAGE_GIB,
} from '#lib/features/snapshots/lib/create-snapshot-form.ts';
import type { CreateSnapshotForm } from '#lib/features/snapshots/state/create-snapshot-wizard.svelte.ts';

interface CreateSnapshotRuntimeStepProps {
	form: CreateSnapshotForm;
	gpuAvailable: boolean;
	gpuOptions: readonly ChipOption[];
}

let { form, gpuAvailable, gpuOptions }: CreateSnapshotRuntimeStepProps =
	$props();
</script>

<form.AppField name="entrypoint">
	{#snippet children(
		field
	)}
		<field.TextField
			label="Startup command"
			placeholder="/bin/bash -l"
			autocomplete="off"
			monospace
			hint="Leave blank to use the container image’s default command."
		/>
	{/snippet}
</form.AppField>
<div class="flex gap-3">
	<form.AppField name="cpu">
		{#snippet children(
			field
		)}
			<field.TextField
				class="min-w-0 flex-1"
				label="vCPUs"
				placeholder={String(DEFAULT_CPU)}
				inputmode="numeric"
				autocomplete="off"
			/>
		{/snippet}
	</form.AppField>
	<form.AppField name="memory">
		{#snippet children(
			field
		)}
			<field.TextField
				class="min-w-0 flex-1"
				label="Memory (GiB)"
				placeholder={String(DEFAULT_MEMORY_GIB)}
				inputmode="numeric"
				autocomplete="off"
			/>
		{/snippet}
	</form.AppField>
	<form.AppField name="disk">
		{#snippet children(
			field
		)}
			<field.TextField
				class="min-w-0 flex-1"
				label="Storage (GiB)"
				placeholder={String(DEFAULT_STORAGE_GIB)}
				inputmode="numeric"
				autocomplete="off"
			/>
		{/snippet}
	</form.AppField>
</div>
{#if gpuAvailable}
	<form.AppField name="gpu">
		{#snippet children(
			field
		)}
			<field.SwitchField
				label="Require a GPU"
				description="Sandboxes created from this snapshot will use one GPU."
			/>
		{/snippet}
	</form.AppField>
	<form.Subscribe selector={(state) => state.values.gpu}>
		{#snippet children(
			gpu
		)}
			{#if gpu}
				<form.AppField name="gpuType">
					{#snippet children(
						field
					)}
						<field.SelectField label="GPU type" options={gpuOptions} />
					{/snippet}
				</form.AppField>
			{/if}
		{/snippet}
	</form.Subscribe>
{/if}
