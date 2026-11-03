<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->
<script lang="ts" module>
import { SANDBOX_CAPABILITY_OPTIONS } from '#lib/features/sandboxes/lib/create/create-sandbox-options.ts';
import {
	type CreateSandboxValues,
	SOURCE,
} from '#lib/features/sandboxes/lib/create/create-sandbox-schema.ts';

const SOURCE_TABS = [
	{ label: 'Snapshot', value: SOURCE.SNAPSHOT },
	{ label: 'Container image', value: SOURCE.IMAGE },
];
const DEFAULT_SNAPSHOT_OPTION = {
	label: 'Snapflow default snapshot',
	value: '',
};

function isSource(value: string): value is CreateSandboxValues['source'] {
	return value === SOURCE.SNAPSHOT || value === SOURCE.IMAGE;
}
</script>

<script lang="ts">
import type { Location, SnapshotDto } from '@snapflow/api-client';
import type { ChipOption } from '#lib/components/ui/chip/chip-selection.ts';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalTabs from '#lib/components/ui/chip-modal/chip-modal-tabs.svelte';
import type { CreateSandboxForm } from '#lib/features/sandboxes/state/create-sandbox-wizard.svelte.ts';
import CreateSandboxPlacementFields from './create-sandbox-placement-fields.svelte';

interface CreateSandboxBasicsStepProps {
	availableSnapshots: readonly SnapshotDto[];
	callerLocation: Location | null;
	form: CreateSandboxForm;
	gpu: boolean;
	gpuAvailable: boolean;
	gpuOptions: readonly ChipOption[];
	locationOptions: readonly ChipOption[];
	open: boolean;
	selectedSnapshot: SnapshotDto | undefined;
	selectedSource: CreateSandboxValues['source'];
}

let {
	availableSnapshots,
	callerLocation,
	form,
	gpu,
	gpuAvailable,
	gpuOptions,
	locationOptions,
	open,
	selectedSnapshot,
	selectedSource,
}: CreateSandboxBasicsStepProps = $props();

const snapshotOptions = $derived([
	DEFAULT_SNAPSHOT_OPTION,
	...availableSnapshots.map((snapshot) => ({
		label: snapshot.name,
		value: snapshot.name,
	})),
]);
</script>

{#snippet fieldHint(
	text: string
)}
	<p class="-mt-1.75 px-2 text-(--text-muted) text-caption">{text}</p>
{/snippet}

<form.AppField name="name">
	{#snippet children(
		field
	)}
		<field.TextField label="Name" placeholder="Generated if empty" />
	{/snippet}
</form.AppField>
<form.AppField name="source">
	{#snippet children(
		field
	)}
		<ChipModalField label="Source">
			<ChipModalTabs
				aria-label="Source"
				tabs={SOURCE_TABS}
				value={field.state.value}
				onChange={(value) => {
					if (isSource(value)) field.handleChange(value);
				}}
			/>
		</ChipModalField>
	{/snippet}
</form.AppField>
{#if selectedSource === SOURCE.SNAPSHOT}
	<form.AppField name="snapshot">
		{#snippet children(
			field
		)}
			<field.SelectField
				label="Snapshot"
				options={snapshotOptions}
				placeholder="Snapflow default snapshot"
			/>
		{/snippet}
	</form.AppField>
	{#if selectedSnapshot}
		{@render fieldHint(
			`${selectedSnapshot.imageName ?? selectedSnapshot.name} · ${selectedSnapshot.cpu} vCPU · ${selectedSnapshot.mem} GiB memory`
		)}
	{/if}
{:else}
	<form.AppField name="image">
		{#snippet children(
			field
		)}
			<field.TextField
				label="Image"
				placeholder="ubuntu:24.04"
				hint="Use a fixed tag or sha256 digest. :latest is not supported."
			/>
		{/snippet}
	</form.AppField>
	<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
		<form.AppField name="cpu">
			{#snippet children(
				field
			)}
				<field.TextField label="vCPUs" inputmode="numeric" />
			{/snippet}
		</form.AppField>
		<form.AppField name="memory">
			{#snippet children(
				field
			)}
				<field.TextField label="Memory (GiB)" inputmode="numeric" />
			{/snippet}
		</form.AppField>
		<form.AppField name="disk">
			{#snippet children(
				field
			)}
				<field.TextField label="Storage (GiB)" inputmode="numeric" />
			{/snippet}
		</form.AppField>
	</div>
	{#if gpuAvailable}
		<form.AppField name="gpu">
			{#snippet children(
				field
			)}
				<field.SwitchField
					label="GPU"
					description="Requires a persistent sandbox."
				/>
			{/snippet}
		</form.AppField>
		{#if gpu}
			<form.AppField name="gpuType">
				{#snippet children(
					field
				)}
					<field.SelectField label="GPU type" options={gpuOptions} />
				{/snippet}
			</form.AppField>
		{/if}
	{/if}
{/if}
<form.AppField name="capabilities">
	{#snippet children(
		field
	)}
		<field.MultiSelectField
			label="Capabilities"
			options={SANDBOX_CAPABILITY_OPTIONS}
			placeholder="None"
		/>
	{/snippet}
</form.AppField>
{@render fieldHint('Desktop also enables developer tools.')}
<CreateSandboxPlacementFields
	{callerLocation}
	{form}
	{locationOptions}
	{open}
/>
