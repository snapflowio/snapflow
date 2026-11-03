<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const DESCRIPTION_ROWS = 4;

interface CreateSecretModalProps {
	open?: boolean;
}
</script>

<script lang="ts">
import { createMutation } from '@tanstack/svelte-query';
import { createSecretMutationOptions } from '#lib/api/secrets.ts';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipTextarea from '#lib/components/ui/chip/chip-textarea.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import SecretValueField from './secret-value-field.svelte';

let { open = $bindable(false) }: CreateSecretModalProps = $props();

const id = $props.id();
const createSecret = createMutation(() => createSecretMutationOptions());

let name = $state('');
let description = $state('');
let value = $state('');

const valid = $derived(name.trim().length > 0 && value.length > 0);

function reset(): void {
	name = '';
	description = '';
	value = '';
}

function close(): void {
	open = false;
	reset();
}

function create(): void {
	if (!valid) return;
	createSecret.mutate({ name, description, value }, { onSuccess: close });
}
</script>

<ChipModal
	bind:open
	onOpenChange={(nextOpen) => {
		if (!nextOpen) reset();
	}}
	onsubmit={create}
	srTitle="Create secret"
	dismissDisabled={createSecret.isPending}
>
	<ChipModalHeader onClose={close} closeDisabled={createSecret.isPending}>
		Create secret
	</ChipModalHeader>
	<ChipModalBody>
		<ChipModalField label="Name" for={`${id}-name`} required>
			<ChipInput
				id={`${id}-name`}
				bind:value={name}
				placeholder="DATABASE_URL"
				autocomplete="off"
			/>
		</ChipModalField>
		<ChipModalField
			label="Value"
			for={`${id}-value`}
			required
			hint="Values are write-only and can't be viewed after saving."
			hintId={`${id}-value-hint`}
		>
			<SecretValueField
				id={`${id}-value`}
				bind:value
				placeholder="Enter value"
				aria-describedby={`${id}-value-hint`}
			/>
		</ChipModalField>
		<ChipModalField label="Description" for={`${id}-description`}>
			<ChipTextarea
				id={`${id}-description`}
				bind:value={description}
				rows={DESCRIPTION_ROWS}
				placeholder="Add a description..."
				autocomplete="off"
			/>
		</ChipModalField>
	</ChipModalBody>
	<ChipModalFooter onCancel={close} cancelDisabled={createSecret.isPending}>
		{#snippet primaryAction()}
			<ChipModalAction
				type="submit"
				variant="primary"
				disabled={!valid || createSecret.isPending}
			>
				{createSecret.isPending ? 'Creating...' : 'Create'}
			</ChipModalAction>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
