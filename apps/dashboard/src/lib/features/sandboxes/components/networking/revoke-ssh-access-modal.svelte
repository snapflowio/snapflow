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

const revokeSshAccessSchema = z.object({
	token: z.string().trim().min(1, 'SSH access token is required'),
});
</script>

<script lang="ts">
import { revalidateLogic } from '@tanstack/svelte-form';
import { createMutation } from '@tanstack/svelte-query';
import { revokeSshAccessMutationOptions } from '#lib/api/sandboxes/sandboxes.ts';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import {
	formSubmitHandler,
	submitMutation,
} from '#lib/components/form/submit.ts';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';

interface RevokeSshAccessModalProps {
	open?: boolean;
	sandboxId: string;
}

let { open = $bindable(false), sandboxId }: RevokeSshAccessModalProps =
	$props();

const revoke = createMutation(() => revokeSshAccessMutationOptions());
const revokeSshForm = createAppForm(() => ({
	defaultValues: { token: '' },
	validationLogic: revalidateLogic(),
	validators: { onDynamic: revokeSshAccessSchema },
	onSubmit: async ({ value }) => {
		await submitMutation(() =>
			revoke.mutateAsync(
				{
					path: { sandboxIdOrName: sandboxId },
					query: { token: value.token.trim() },
				},
				{
					onSuccess: () => {
						open = false;
						revokeSshForm.reset();
					},
				}
			)
		);
	},
}));

function close() {
	open = false;
}

function changeOpen(nextOpen: boolean) {
	if (!nextOpen) revokeSshForm.reset();
}
</script>

<ChipModal
	bind:open
	onOpenChange={changeOpen}
	onsubmit={formSubmitHandler(revokeSshForm)}
	srTitle="Revoke SSH access"
>
	<ChipModalHeader onClose={close}>Revoke SSH access</ChipModalHeader>
	<ChipModalBody>
		<revokeSshForm.AppField name="token">
			{#snippet children(
				field
			)}
				<field.TextField
					label="Token"
					hint="The token embedded in the SSH command. Access ends immediately."
					placeholder="Paste a token"
					secret
				/>
			{/snippet}
		</revokeSshForm.AppField>
	</ChipModalBody>
	<ChipModalFooter onCancel={close} cancelDisabled={revoke.isPending}>
		{#snippet primaryAction(
			initialFocus
		)}
			<ChipModalAction
				type="submit"
				variant="destructive"
				disabled={revoke.isPending}
				{@attach initialFocus}
			>
				{revoke.isPending ? 'Revoking...' : 'Revoke'}
			</ChipModalAction>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
