<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { revalidateLogic } from '@tanstack/svelte-form';
import { createMutation } from '@tanstack/svelte-query';
import { addCustomDomainMutationOptions } from '#lib/api/sandboxes/custom-domains.ts';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import {
	formSubmitHandler,
	submitMutation,
} from '#lib/components/form/submit.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import { addCustomDomainSchema } from '#lib/features/custom-domains/lib/custom-domain-format.ts';
import {
	DEFAULT_PREVIEW_PORT,
	MAX_TCP_PORT,
	MIN_TCP_PORT,
} from '#lib/features/sandboxes/lib/sandbox-port-preview.ts';

interface AddCustomDomainModalProps {
	open?: boolean;
	sandboxId: string;
}

let { open = $bindable(false), sandboxId }: AddCustomDomainModalProps =
	$props();

const add = createMutation(() => addCustomDomainMutationOptions(sandboxId));
const form = createAppForm(() => ({
	defaultValues: { port: '', hostname: '' },
	validationLogic: revalidateLogic(),
	validators: { onDynamic: addCustomDomainSchema },
	onSubmit: async ({ value }) => {
		await submitMutation(() =>
			add.mutateAsync(
				{ port: Number(value.port), hostname: value.hostname.trim() },
				{
					onSuccess: () => {
						open = false;
					},
				}
			)
		);
	},
}));

function changeOpen(next: boolean): void {
	if (!next) form.reset();
}
</script>

<ChipModal
	bind:open
	onOpenChange={changeOpen}
	onsubmit={formSubmitHandler(form)}
	dismissDisabled={add.isPending}
	srTitle="Add custom domain"
	variant="sheet"
>
	<ChipModalHeader onClose={() => (open = false)}>
		Add custom domain
	</ChipModalHeader>
	<ChipModalBody>
		<form.AppField name="hostname">
			{#snippet children(field)}
				<field.TextField label="Hostname" placeholder="app.example.com" />
			{/snippet}
		</form.AppField>
		<form.AppField name="port">
			{#snippet children(field)}
				<field.TextField
					label="Sandbox port"
					type="number"
					min={MIN_TCP_PORT}
					max={MAX_TCP_PORT}
					placeholder={DEFAULT_PREVIEW_PORT}
				/>
			{/snippet}
		</form.AppField>
	</ChipModalBody>
	<ChipModalFooter
		onCancel={() => (open = false)}
		cancelDisabled={add.isPending}
	>
		{#snippet primaryAction(initialFocus)}
			<Chip
				loading={add.isPending}
				type="submit"
				variant="primary"
				disabled={add.isPending}
				{@attach initialFocus}
			>
				Add domain
			</Chip>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
