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

const SSH_ACCESS_MIN_EXPIRY_MINUTES = 1;
const SSH_ACCESS_MAX_EXPIRY_MINUTES = 1440;
const DEFAULT_SSH_ACCESS_EXPIRY_MINUTES = '60';

const sshAccessSchema = z.object({
	expiryMinutes: z.string().refine((value) => {
		const minutes = Number(value);
		return (
			Number.isInteger(minutes) &&
			minutes >= SSH_ACCESS_MIN_EXPIRY_MINUTES &&
			minutes <= SSH_ACCESS_MAX_EXPIRY_MINUTES
		);
	}, `Expiry must be between ${SSH_ACCESS_MIN_EXPIRY_MINUTES} and ${SSH_ACCESS_MAX_EXPIRY_MINUTES} minutes`),
});
</script>

<script lang="ts">
import KeyRound from '@lucide/svelte/icons/key-round';
import Plus from '@lucide/svelte/icons/plus';
import type { SshAccessDto } from '@snapflow/api-client';
import { revalidateLogic } from '@tanstack/svelte-form';
import { createMutation } from '@tanstack/svelte-query';
import { idempotencyHeaders } from '#lib/api/client/api-client.ts';
import { createSshAccessMutationOptions } from '#lib/api/sandboxes/sandboxes.ts';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import {
	formSubmitHandler,
	submitMutation,
} from '#lib/components/form/submit.ts';
import SettingsResourceRow from '#lib/components/settings/settings-resource-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipCopyInput from '#lib/components/ui/chip/chip-copy-input.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import { isSandboxInteractive } from '#lib/features/sandboxes/lib/sandbox-state.ts';
import { getSandboxDetail } from '#lib/features/sandboxes/state/sandbox-detail.svelte.ts';
import { formatDateTime } from '#lib/utils/format.ts';
import RevokeSshAccessModal from './revoke-ssh-access-modal.svelte';

const detail = getSandboxDetail();
const canManageSsh = $derived(
	detail.canWrite && isSandboxInteractive(detail.sandbox)
);
let sshAccess = $state.raw<SshAccessDto | null>(null);
let createSshOpen = $state(false);
let revokeSshOpen = $state(false);

const create = createMutation(() => createSshAccessMutationOptions());
const sshAccessForm = createAppForm(() => ({
	defaultValues: { expiryMinutes: DEFAULT_SSH_ACCESS_EXPIRY_MINUTES },
	validationLogic: revalidateLogic(),
	validators: { onDynamic: sshAccessSchema },
	onSubmit: async ({ value }) => {
		await submitMutation(() =>
			create.mutateAsync(
				{
					path: { sandboxIdOrName: detail.sandbox.id },
					query: { expiresInMinutes: Number(value.expiryMinutes) },
					headers: idempotencyHeaders(),
				},
				{
					onSuccess: (access) => {
						sshAccess = access;
					},
				}
			)
		);
	},
}));

function openCreate() {
	sshAccessForm.reset();
	sshAccess = null;
	createSshOpen = true;
}

function closeCreate() {
	createSshOpen = false;
}

function changeCreateOpen(open: boolean) {
	if (open) return;
	sshAccess = null;
	sshAccessForm.reset();
}
</script>

<SettingsSection title="SSH access">
	<SettingsResourceRow
		icon={KeyRound}
		title="Temporary SSH command"
		description="Grants direct terminal access until it expires"
	>
		{#snippet trailing()}
			<Chip
				disabled={detail.pending || !canManageSsh}
				onclick={() => {
					revokeSshOpen = true;
				}}
			>
				Revoke
			</Chip>
			<Chip
				leftIcon={Plus}
				disabled={detail.pending || !canManageSsh}
				onclick={openCreate}
			>
				Create
			</Chip>
		{/snippet}
	</SettingsResourceRow>
</SettingsSection>
<ChipModal
	bind:open={createSshOpen}
	onOpenChange={changeCreateOpen}
	onsubmit={formSubmitHandler(sshAccessForm)}
	srTitle="Create SSH access"
>
	<ChipModalHeader onClose={closeCreate}>
		{sshAccess ? 'Copy your SSH command' : 'Create SSH access'}
	</ChipModalHeader>
	<ChipModalBody>
		{#if sshAccess}
			<ChipModalField
				label="SSH command"
				hint={`Shown once. Expires ${formatDateTime(sshAccess.expiresAt)}.`}
			>
				<ChipCopyInput
					value={sshAccess.sshCommand}
					copyLabel="Copy SSH command"
					aria-label="SSH command"
				/>
			</ChipModalField>
			<ChipModalField
				label="Host key"
				hint="Pin this Edge relay host key before connecting."
			>
				<ChipCopyInput
					value={sshAccess.hostPublicKey}
					copyLabel="Copy SSH host key"
					aria-label="SSH host key"
				/>
			</ChipModalField>
		{:else}
			<sshAccessForm.AppField name="expiryMinutes">
				{#snippet children(
					field
				)}
					<field.TextField
						label="Expires after (minutes)"
						type="number"
						min={SSH_ACCESS_MIN_EXPIRY_MINUTES}
						max={SSH_ACCESS_MAX_EXPIRY_MINUTES}
					/>
				{/snippet}
			</sshAccessForm.AppField>
		{/if}
	</ChipModalBody>
	<ChipModalFooter
		onCancel={closeCreate}
		cancelDisabled={create.isPending}
		hideCancel={sshAccess !== null}
	>
		{#snippet primaryAction(
			initialFocus
		)}
			{#if sshAccess}
				<ChipModalAction
					variant="primary"
					disabled={create.isPending}
					onclick={closeCreate}
					{@attach initialFocus}
				>
					Done
				</ChipModalAction>
			{:else}
				<ChipModalAction
					type="submit"
					variant="primary"
					disabled={create.isPending}
					{@attach initialFocus}
				>
					{create.isPending ? 'Creating...' : 'Create'}
				</ChipModalAction>
			{/if}
		{/snippet}
	</ChipModalFooter>
</ChipModal>
<RevokeSshAccessModal bind:open={revokeSshOpen} sandboxId={detail.sandbox.id} />
