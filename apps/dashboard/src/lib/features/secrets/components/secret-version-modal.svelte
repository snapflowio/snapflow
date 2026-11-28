<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { SecretDto } from '@snapflow/api-client';
import { createMutation } from '@tanstack/svelte-query';
import { rotateSecretMutationOptions } from '#lib/api/secrets.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import SecretValueField from './secret-value-field.svelte';

interface SecretVersionModalProps {
	secret: SecretDto | null;
	onClose: () => void;
}

let { secret, onClose }: SecretVersionModalProps = $props();

const id = $props.id();
const rotate = createMutation(() => rotateSecretMutationOptions());
let value = $state('');

function close(): void {
	value = '';
	onClose();
}

function save(): void {
	if (!secret || value.length === 0) return;
	rotate.mutate({ secret, value }, { onSuccess: close });
}
</script>

<ChipModal
	bind:open={
		() => secret !== null,
		(open) => {
	if (!open) close();
}
	}
	onsubmit={save}
	srTitle="New version"
	variant="sheet"
	hasUnsavedInput={value.length > 0}
	dismissDisabled={rotate.isPending}
>
	<ChipModalHeader onClose={close} closeDisabled={rotate.isPending}>
		New version
	</ChipModalHeader>
	<ChipModalBody>
		<ChipModalField
			label="Value"
			for={`${id}-value`}
			required
			hint="Sandboxes pick up the new version the next time they start."
			hintId={`${id}-value-hint`}
		>
			<SecretValueField
				id={`${id}-value`}
				bind:value
				placeholder="Enter the new value"
				aria-describedby={`${id}-value-hint`}
			/>
		</ChipModalField>
	</ChipModalBody>
	<ChipModalFooter onCancel={close} cancelDisabled={rotate.isPending}>
		{#snippet primaryAction()}
			<Chip
				type="submit"
				variant="primary"
				loading={rotate.isPending}
				disabled={value.length === 0}
			>
				Create version
			</Chip>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
