<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { revalidateLogic } from '@tanstack/svelte-form';
import { createMutation } from '@tanstack/svelte-query';
import {
	resizeSandboxMutationOptions,
	sandboxLabelsMutationOptions,
	sandboxLifecyclePolicyMutationOptions,
} from '#lib/api/sandboxes/sandboxes.ts';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import {
	formSubmitHandler,
	submitMutation,
} from '#lib/components/form/submit.ts';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import {
	type ConfigurationMode,
	type ConfigurationValues,
	configurationSchema,
	configurationValues,
	integer,
	parseLabels,
	positiveNumber,
} from '#lib/features/sandboxes/lib/sandbox-configuration.ts';
import { getSandboxDetail } from '#lib/features/sandboxes/state/sandbox-detail.svelte.ts';

const DEFAULT_MODE: ConfigurationMode = 'resources';

interface SandboxConfigurationFormProps {
	mode: ConfigurationMode | null;
	onSaved: () => void;
}

let { mode, onSaved }: SandboxConfigurationFormProps = $props();

const detail = getSandboxDetail();
const resize = createMutation(() =>
	resizeSandboxMutationOptions(detail.sandbox.id)
);
const lifecycle = createMutation(() =>
	sandboxLifecyclePolicyMutationOptions(detail.sandbox.id)
);
const labels = createMutation(() =>
	sandboxLabelsMutationOptions(detail.sandbox.id)
);

function submitConfiguration(value: ConfigurationValues): Promise<boolean> {
	if (value.mode === 'resources') {
		return submitMutation(() =>
			resize.mutateAsync({
				cpu: positiveNumber(value.cpu, 'CPU'),
				memory: positiveNumber(value.memory, 'Memory'),
				disk: positiveNumber(value.disk, 'Disk'),
			})
		);
	}
	if (value.mode === 'lifecycle') {
		return submitMutation(() =>
			lifecycle.mutateAsync({
				autoStop: integer(value.autoStop, 'Auto-stop interval'),
				autoArchive: integer(value.autoArchive, 'Auto-archive interval'),
				autoDelete: integer(value.autoDelete, 'Auto-delete interval'),
			})
		);
	}
	return submitMutation(() =>
		labels.mutateAsync({ labels: parseLabels(value.labels) })
	);
}

const form = createAppForm(() => ({
	defaultValues: configurationValues(mode ?? DEFAULT_MODE, detail.sandbox),
	validationLogic: revalidateLogic(),
	validators: { onDynamic: configurationSchema },
	onSubmit: async ({ value }) => {
		if (await submitConfiguration({ ...value, mode: mode ?? value.mode })) {
			onSaved();
		}
	},
}));
</script>

{#snippet submitAction()}
	<form.AppForm>
		<form.SubmitButton disabled={detail.pending} pendingLabel="Saving...">
			Save
		</form.SubmitButton>
	</form.AppForm>
{/snippet}

<form class="contents" novalidate onsubmit={formSubmitHandler(form)}>
	<ChipModalBody>
		{#if mode === 'resources'}
			<form.AppField name="cpu">
				{#snippet children(
					field
				)}
					<field.TextField label="CPU" type="number" />
				{/snippet}
			</form.AppField>
			<form.AppField name="memory">
				{#snippet children(
					field
				)}
					<field.TextField label="Memory (GiB)" type="number" />
				{/snippet}
			</form.AppField>
			<form.AppField name="disk">
				{#snippet children(
					field
				)}
					<field.TextField label="Disk (GiB)" type="number" />
				{/snippet}
			</form.AppField>
		{/if}
		{#if mode === 'lifecycle'}
			<form.AppField name="autoStop">
				{#snippet children(
					field
				)}
					<field.TextField
						label="Stop after inactivity (minutes)"
						type="number"
					/>
				{/snippet}
			</form.AppField>
			<form.AppField name="autoArchive">
				{#snippet children(
					field
				)}
					<field.TextField
						label="Archive after stopping (minutes)"
						hint="-1 disables"
						type="number"
					/>
				{/snippet}
			</form.AppField>
			<form.AppField name="autoDelete">
				{#snippet children(
					field
				)}
					<field.TextField
						label="Delete after stopping (minutes)"
						hint="-1 disables"
						type="number"
					/>
				{/snippet}
			</form.AppField>
		{/if}
		{#if mode === 'labels'}
			<form.AppField name="labels">
				{#snippet children(
					field
				)}
					<field.TextareaField
						label="Labels"
						placeholder={'environment=development\nteam=platform'}
					/>
				{/snippet}
			</form.AppField>
		{/if}
	</ChipModalBody>
	<ChipModalFooter primaryAction={submitAction} />
</form>
