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
import type { CreateSnapshotForm } from '#lib/features/snapshots/state/create-snapshot-wizard.svelte.ts';

interface CreateSnapshotSourceStepProps {
	form: CreateSnapshotForm;
	sandboxClassOptions: readonly ChipOption[];
}

let { form, sandboxClassOptions }: CreateSnapshotSourceStepProps = $props();
</script>

<form.AppField name="name">
	{#snippet children(
		field
	)}
		<field.TextField label="Name" placeholder="node-22" autocomplete="off" />
	{/snippet}
</form.AppField>
<form.AppField name="imageName">
	{#snippet children(
		field
	)}
		<field.TextField
			label="Container image"
			placeholder="ubuntu:24.04"
			autocomplete="off"
			monospace
			hint="Use a fixed tag or sha256 digest. The :latest tag is not supported."
		/>
	{/snippet}
</form.AppField>
{#if sandboxClassOptions.length > 1}
	<form.AppField name="sandboxClass">
		{#snippet children(
			field
		)}
			<field.SelectField
				label="Environment type"
				options={sandboxClassOptions}
			/>
		{/snippet}
	</form.AppField>
{/if}
