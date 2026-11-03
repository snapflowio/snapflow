<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->
<script lang="ts">
import type { CreateSandboxForm } from '#lib/features/sandboxes/state/create-sandbox-wizard.svelte.ts';
import { PlacementMachines } from '#lib/features/sandboxes/state/placement-machines.svelte.ts';

interface CreateSandboxPinnedMachineFieldProps {
	form: CreateSandboxForm;
	machineId: string;
	open: boolean;
}

let { form, machineId, open }: CreateSandboxPinnedMachineFieldProps = $props();

const machines = new PlacementMachines(() => ({
	enabled: open,
	selectedMachineId: machineId,
}));
</script>

<form.AppField name="machineId">
	{#snippet children(
		field
	)}
		<field.SelectField
			label="Machine"
			options={machines.options}
			placeholder="Select a machine"
		/>
	{/snippet}
</form.AppField>
<p class="-mt-1.75 px-2 text-(--text-muted) text-caption">
	The sandbox always runs on this machine.
</p>
