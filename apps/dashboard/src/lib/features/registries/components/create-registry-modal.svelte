<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const GCP_KEY_PLACEHOLDER = '{\n  "type": "service_account"\n}';
const GCP_KEY_ROWS = 8;
const ROLE_HINT =
	'Snapflow assumes this role to pull images. No password is stored.';

interface CreateRegistryModalProps {
	open?: boolean;
}
</script>

<script lang="ts">
import { revalidateLogic } from '@tanstack/svelte-form';
import { createMutation } from '@tanstack/svelte-query';
import { idempotencyHeaders } from '#lib/api/client/api-client.ts';
import { createRegistryMutationOptions } from '#lib/api/registries.ts';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import { formSubmitHandler } from '#lib/components/form/submit.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import ChipModalTabs from '#lib/components/ui/chip-modal/chip-modal-tabs.svelte';
import {
	DEFAULT_REGISTRY_PROVIDER,
	DEFAULT_REGISTRY_URL,
	isRegistryProvider,
	REGISTRY_PROVIDER_SPECS,
	REGISTRY_PROVIDER_TABS,
	type RegistryProvider,
	registryDefaults,
	registrySchema,
	registryUrlPlaceholder,
	registryUsernamePlaceholder,
} from '#lib/features/registries/lib/registry-provider-specs.ts';

let { open = $bindable(false) }: CreateRegistryModalProps = $props();

const createRegistry = createMutation(() => createRegistryMutationOptions());
let provider = $state<RegistryProvider>(DEFAULT_REGISTRY_PROVIDER);
const spec = $derived(REGISTRY_PROVIDER_SPECS[provider]);
const form = createAppForm(() => ({
	defaultValues: registryDefaults(DEFAULT_REGISTRY_PROVIDER),
	validationLogic: revalidateLogic(),
	validators: { onDynamic: registrySchema(provider) },
	onSubmit: async ({ value }) => {
		await createRegistry.mutateAsync({
			body: {
				name: value.name.trim(),
				url: value.url.trim() || DEFAULT_REGISTRY_URL,
				username: value.username.trim(),
				password: value.password.trim(),
				project: value.project.trim() || undefined,
			},
			headers: idempotencyHeaders(),
		});
		open = false;
	},
}));

function resetForm(): void {
	provider = DEFAULT_REGISTRY_PROVIDER;
	form.reset(registryDefaults(DEFAULT_REGISTRY_PROVIDER));
}

function discard(): void {
	open = false;
	resetForm();
}

function changeProvider(value: string): void {
	if (!isRegistryProvider(value)) return;
	const name = form.getFieldValue('name');
	provider = value;
	form.reset({ ...registryDefaults(value), name });
}
</script>

<ChipModal
	bind:open
	srTitle="New registry"
	variant="sheet"
	onOpenChange={(nextOpen) => {
		if (!nextOpen) resetForm();
	}}
	onsubmit={formSubmitHandler(form)}
>
	<ChipModalHeader onClose={discard}>New registry</ChipModalHeader>
	<ChipModalBody>
		<ChipModalTabs
			tabs={REGISTRY_PROVIDER_TABS}
			value={provider}
			onChange={changeProvider}
			aria-label="Registry provider"
			class="w-full"
		/>
		<form.AppField name="name">
			{#snippet children(field)}
				<field.TextField
					label="Name"
					placeholder="production-registry"
					autocomplete="off"
				/>
			{/snippet}
		</form.AppField>
		{#if !spec.urlHidden}
			<form.AppField name="url">
				{#snippet children(field)}
					<field.TextField
						label="URL"
						placeholder={registryUrlPlaceholder(provider)}
					/>
				{/snippet}
			</form.AppField>
		{/if}
		{#if !spec.usernameHidden}
			<form.AppField name="username">
				{#snippet children(field)}
					<field.TextField
						label={spec.usernameLabel}
						placeholder={registryUsernamePlaceholder(provider)}
						hint={spec.passwordHidden ? ROLE_HINT : undefined}
					/>
				{/snippet}
			</form.AppField>
		{/if}
		{#if spec.passwordMultiline}
			<form.AppField name="password">
				{#snippet children(field)}
					<field.TextareaField
						label={spec.passwordLabel}
						placeholder={GCP_KEY_PLACEHOLDER}
						rows={GCP_KEY_ROWS}
						class="font-mono text-xs"
					/>
				{/snippet}
			</form.AppField>
		{:else if !spec.passwordHidden}
			<form.AppField name="password">
				{#snippet children(field)}
					<field.TextField label={spec.passwordLabel} secret />
				{/snippet}
			</form.AppField>
		{/if}
		{#if spec.projectLabel}
			{const projectLabel = $derived(spec.projectLabel)}
			<form.AppField name="project">
				{#snippet children(field)}
					<field.TextField label={projectLabel} placeholder="my-project" />
				{/snippet}
			</form.AppField>
		{/if}
	</ChipModalBody>
	<form.Subscribe selector={(state) => state.isSubmitting}>
		{#snippet children(isSubmitting)}
			<ChipModalFooter onCancel={discard} cancelDisabled={isSubmitting}>
				{#snippet primaryAction()}
					<Chip
						loading={isSubmitting}
						type="submit"
						variant="primary"
						disabled={isSubmitting}
					>
						Create
					</Chip>
				{/snippet}
			</ChipModalFooter>
		{/snippet}
	</form.Subscribe>
</ChipModal>
