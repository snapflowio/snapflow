<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import * as z from 'zod';

const DEFAULT_VOLUME_SIZE_GIB = 10;
const MIN_VOLUME_SIZE_GIB = 1;
const MAX_VOLUME_SIZE_GIB = 2048;
const createVolumeSchema = z.object({
	name: z.string().trim().min(1, 'Name is required'),
	sizeGiB: z.string().refine((value) => {
		const size = Number(value);
		return (
			Number.isInteger(size) &&
			size >= MIN_VOLUME_SIZE_GIB &&
			size <= MAX_VOLUME_SIZE_GIB
		);
	}, `Size must be a whole number from ${MIN_VOLUME_SIZE_GIB} to ${MAX_VOLUME_SIZE_GIB} GiB`),
});

interface CreateVolumeModalProps {
	open?: boolean;
}
</script>

<script lang="ts">
import { revalidateLogic } from '@tanstack/svelte-form';
import { createMutation } from '@tanstack/svelte-query';
import { idempotencyHeaders } from '#lib/api/client/api-client.ts';
import { createVolumeMutationOptions } from '#lib/api/volumes.ts';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import { formSubmitHandler } from '#lib/components/form/submit.ts';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';

let { open = $bindable(false) }: CreateVolumeModalProps = $props();

const createVolume = createMutation(() => createVolumeMutationOptions());
const form = createAppForm(() => ({
	defaultValues: { name: '', sizeGiB: String(DEFAULT_VOLUME_SIZE_GIB) },
	validationLogic: revalidateLogic(),
	validators: { onDynamic: createVolumeSchema },
	onSubmit: async ({ value }) => {
		await createVolume.mutateAsync({
			body: { name: value.name.trim(), sizeGiB: Number(value.sizeGiB) },
			headers: idempotencyHeaders(),
		});
		close();
	},
}));

function close(): void {
	open = false;
	form.reset();
}
</script>

<ChipModal
	bind:open
	onOpenChange={(nextOpen) => {
		if (!nextOpen) form.reset();
	}}
	onsubmit={formSubmitHandler(form)}
	srTitle="Create volume"
>
	<form.AppForm>
		<ChipModalHeader onClose={close}>Create volume</ChipModalHeader>
		<ChipModalBody>
			<form.AppField name="name">
				{#snippet children(
					field
				)}
					<field.TextField
						label="Name"
						placeholder="workspace-data"
						autocomplete="off"
					/>
				{/snippet}
			</form.AppField>
			<form.AppField name="sizeGiB">
				{#snippet children(
					field
				)}
					<field.TextField
						label="Size (GiB)"
						type="number"
						min={MIN_VOLUME_SIZE_GIB}
						max={MAX_VOLUME_SIZE_GIB}
					/>
				{/snippet}
			</form.AppField>
		</ChipModalBody>
		<ChipModalFooter onCancel={close}>
			{#snippet primaryAction()}
				<form.SubmitButton pendingLabel="Creating...">Create</form.SubmitButton>
			{/snippet}
		</ChipModalFooter>
	</form.AppForm>
</ChipModal>
