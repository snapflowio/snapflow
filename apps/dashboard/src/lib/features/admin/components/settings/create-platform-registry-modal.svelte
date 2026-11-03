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
import { registryUrlSchema } from '#lib/features/registries/lib/registry-validation.ts';

const schema = z.object({
	name: z.string().trim().min(1, 'Registry name is required'),
	url: registryUrlSchema,
	username: z.string().trim().min(1, 'Username is required'),
	password: z.string().min(1, 'Password is required'),
	project: z.string().trim(),
});

const DEFAULT_VALUES: z.input<typeof schema> = {
	name: '',
	url: '',
	username: '',
	password: '',
	project: '',
};
</script>

<script lang="ts">
import { revalidateLogic } from '@tanstack/svelte-form';
import { createMutation } from '@tanstack/svelte-query';
import { createPlatformRegistryMutationOptions } from '#lib/api/admin/platform-settings.ts';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import {
	formSubmitHandler,
	submitMutation,
} from '#lib/components/form/submit.ts';
import HexSimple from '#lib/components/icons/hex-simple.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';

interface CreatePlatformRegistryModalProps {
	open?: boolean;
}

let { open = $bindable(false) }: CreatePlatformRegistryModalProps = $props();

const create = createMutation(() => createPlatformRegistryMutationOptions());
const form = createAppForm(() => ({
	defaultValues: DEFAULT_VALUES,
	validationLogic: revalidateLogic(),
	validators: { onDynamic: schema },
	onSubmit: async ({ value }) => {
		const parsed = schema.parse(value);
		if (
			!(await submitMutation(() =>
				create.mutateAsync({ ...parsed, project: parsed.project || undefined })
			))
		)
			return;
		close();
	},
}));

function close() {
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
	srTitle="New platform registry"
>
	<form.AppForm>
		<ChipModalHeader icon={HexSimple} onClose={close}>
			New platform registry
		</ChipModalHeader>
		<ChipModalBody>
			<form.AppField name="name">
				{#snippet children(
					field
				)}
					<field.TextField label="Name" placeholder="platform" />
				{/snippet}
			</form.AppField>
			<form.AppField name="url">
				{#snippet children(
					field
				)}
					<field.TextField
						label="URL"
						placeholder="https://registry.example.com"
					/>
				{/snippet}
			</form.AppField>
			<form.AppField name="username">
				{#snippet children(
					field
				)}
					<field.TextField label="Username" />
				{/snippet}
			</form.AppField>
			<form.AppField name="password">
				{#snippet children(
					field
				)}
					<field.TextField label="Password" secret />
				{/snippet}
			</form.AppField>
			<form.AppField name="project">
				{#snippet children(
					field
				)}
					<field.TextField label="Project" placeholder="Optional" />
				{/snippet}
			</form.AppField>
		</ChipModalBody>
		<ChipModalFooter onCancel={close}>
			{#snippet primaryAction()}
				<form.SubmitButton pendingLabel="Creating...">
					Create
				</form.SubmitButton>
			{/snippet}
		</ChipModalFooter>
	</form.AppForm>
</ChipModal>
