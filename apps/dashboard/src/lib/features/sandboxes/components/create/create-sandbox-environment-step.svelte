<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->
<script lang="ts">
import type { SecretDto, VolumeDto } from '@snapflow/api-client';
import type { CreateSandboxForm } from '#lib/features/sandboxes/state/create-sandbox-wizard.svelte.ts';

interface CreateSandboxEnvironmentStepProps {
	availableVolumes: readonly VolumeDto[];
	form: CreateSandboxForm;
	secrets: readonly SecretDto[] | undefined;
}

let { availableVolumes, form, secrets }: CreateSandboxEnvironmentStepProps =
	$props();
</script>

{#snippet fieldHint(
	text: string
)}
	<p class="-mt-1.75 px-2 text-(--text-muted) text-caption">{text}</p>
{/snippet}

<form.AppField name="environment">
	{#snippet children(
		field
	)}
		<field.KeyValueField
			allowEnvFileImport
			label="Environment variables"
			keyPlaceholder="VARIABLE"
			valuePlaceholder="value"
		/>
	{/snippet}
</form.AppField>
<form.AppField name="secretBindings">
	{#snippet children(
		field
	)}
		<field.KeyValueField
			label="Secret variables"
			keyPlaceholder="VARIABLE"
			valuePlaceholder="secret name"
		/>
	{/snippet}
</form.AppField>
{@render fieldHint(
	secrets?.length
		? `Available: ${secrets.map(({ name }) => name).join(', ')}. Each variable uses the secret’s current version.`
		: 'No secrets yet.'
)}
<form.AppField name="volumeMounts">
	{#snippet children(
		field
	)}
		<field.KeyValueField
			label="Volumes"
			keyPlaceholder="volume name"
			valuePlaceholder="/mount/path"
		/>
	{/snippet}
</form.AppField>
{@render fieldHint(
	availableVolumes.length
		? `Available: ${availableVolumes.map(({ name }) => name).join(', ')}.`
		: 'No ready volumes yet.'
)}
<form.AppField name="labels">
	{#snippet children(
		field
	)}
		<field.KeyValueField
			label="Labels"
			keyPlaceholder="label"
			valuePlaceholder="value"
		/>
	{/snippet}
</form.AppField>
