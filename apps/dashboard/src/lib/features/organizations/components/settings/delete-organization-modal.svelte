<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';

interface DeleteOrganizationModalProps {
	open?: boolean;
	organizationName: string;
	pending: boolean;
	onDelete: () => void;
}

let {
	open = $bindable(false),
	organizationName,
	pending,
	onDelete,
}: DeleteOrganizationModalProps = $props();

const inputId = $props.id();
let confirmation = $state('');
const matches = $derived(confirmation === organizationName);

function submit(): void {
	if (!matches || pending) return;
	onDelete();
}
</script>

<ChipModalConfirm
	bind:open
	onOpenChange={(nextOpen) => {
		if (!nextOpen) confirmation = '';
	}}
	onsubmit={submit}
	title="Delete organization"
	text={[
		'Deleting ',
		{ text: organizationName, bold: true },
		' ',
		{
			text: 'removes access for every member and cannot be undone.',
			error: true,
		},
		' Stop and delete its sandboxes, snapshots, volumes and machines first.',
	]}
	{pending}
>
	<ChipModalField label="Type the organization name to confirm" for={inputId}>
		<ChipInput
			id={inputId}
			bind:value={confirmation}
			placeholder={organizationName}
			autocomplete="off"
			disabled={pending}
		/>
	</ChipModalField>
	{#snippet confirm()}
		<ChipModalAction
			type="submit"
			variant="destructive"
			disabled={pending || !matches}
			disabledTooltip={pending
				? undefined
				: 'Enter the organization name to confirm'}
		>
			{pending ? 'Deleting...' : 'Delete'}
		</ChipModalAction>
	{/snippet}
</ChipModalConfirm>
