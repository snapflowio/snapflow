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
const NAME_REQUIRED = 'Name is required';
</script>

<script lang="ts">
import type { SecretDto } from '@snapflow/api-client';
import { createMutation } from '@tanstack/svelte-query';
import { updateSecretMutationOptions } from '#lib/api/secrets.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipTextarea from '#lib/components/ui/chip/chip-textarea.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';

interface EditSecretModalProps {
	secret: SecretDto;
	onClose: () => void;
}

let { secret, onClose }: EditSecretModalProps = $props();

const id = $props.id();
const update = createMutation(() => updateSecretMutationOptions(secret.id));
let nameDraft = $state<string | null>(null);
let descriptionDraft = $state<string | null>(null);

const savedDescription = $derived(secret.description ?? '');
const name = $derived(nameDraft ?? secret.name);
const description = $derived(descriptionDraft ?? savedDescription);
const dirty = $derived(
	name.trim() !== secret.name || description.trim() !== savedDescription
);
const nameError = $derived(
	nameDraft !== null && !name.trim() ? NAME_REQUIRED : null
);

function close(): void {
	nameDraft = null;
	descriptionDraft = null;
	onClose();
}

function save(): void {
	if (!dirty || nameError) return;
	update.mutate(
		{ name: name.trim(), description: description.trim() },
		{ onSuccess: close }
	);
}
</script>

<ChipModal
	open
	onOpenChange={(open) => {
		if (!open) close();
	}}
	onsubmit={save}
	srTitle="Edit secret"
	variant="sheet"
	hasUnsavedInput={dirty}
	dismissDisabled={update.isPending}
>
	<ChipModalHeader onClose={close} closeDisabled={update.isPending}>
		Edit secret
	</ChipModalHeader>
	<ChipModalBody>
		<ChipModalField
			label="Name"
			for={`${id}-name`}
			required
			error={nameError}
			errorId={`${id}-name-error`}
		>
			<ChipInput
				id={`${id}-name`}
				value={name}
				oninput={(event) => (nameDraft = event.currentTarget.value)}
				error={Boolean(nameError)}
				aria-describedby={nameError ? `${id}-name-error` : undefined}
				autocomplete="off"
			/>
		</ChipModalField>
		<ChipModalField label="Description" for={`${id}-description`}>
			<ChipTextarea
				id={`${id}-description`}
				value={description}
				oninput={(event) => (descriptionDraft = event.currentTarget.value)}
				rows={DESCRIPTION_ROWS}
				placeholder="Add a description..."
				autocomplete="off"
			/>
		</ChipModalField>
	</ChipModalBody>
	<ChipModalFooter onCancel={close} cancelDisabled={update.isPending}>
		{#snippet primaryAction()}
			<Chip
				type="submit"
				variant="primary"
				loading={update.isPending}
				disabled={!dirty || Boolean(nameError)}
			>
				Save
			</Chip>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
