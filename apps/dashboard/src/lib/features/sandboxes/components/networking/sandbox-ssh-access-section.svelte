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
const SSH_DISABLED_REASONS = {
	permission: 'You need sandbox write access to manage SSH',
	stateChange: 'Wait for the current sandbox action to finish',
	notRunning: 'Start the sandbox to create SSH access',
} as const;

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
import { createMutation, createQuery } from '@tanstack/svelte-query';
import { idempotencyHeaders } from '#lib/api/client/api-client.ts';
import {
	createSshAccessMutationOptions,
	sshAccessGrantsQueryOptions,
} from '#lib/api/sandboxes/sandboxes.ts';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import {
	formSubmitHandler,
	submitMutation,
} from '#lib/components/form/submit.ts';
import SettingsResourceRow from '#lib/components/settings/settings-resource-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import LabeledCheckbox from '#lib/components/ui/checkbox/labeled-checkbox.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipCopyInput from '#lib/components/ui/chip/chip-copy-input.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import { isSandboxInteractive } from '#lib/features/sandboxes/lib/sandbox-state.ts';
import { getSandboxDetail } from '#lib/features/sandboxes/state/sandbox-detail.svelte.ts';
import { formatDateTime } from '#lib/utils/format.ts';
import RevokeSshAccessModal, {
	REVOKE_ALL_SSH_ACCESS,
	type SshAccessRevokeTarget,
} from './revoke-ssh-access-modal.svelte';

const detail = getSandboxDetail();
const createDisabledReason = $derived.by(() => {
	if (!detail.canWrite) return SSH_DISABLED_REASONS.permission;
	if (detail.pending) return SSH_DISABLED_REASONS.stateChange;
	if (!isSandboxInteractive(detail.sandbox))
		return SSH_DISABLED_REASONS.notRunning;
	return null;
});
let sshAccess = $state.raw<SshAccessDto | null>(null);
let acknowledged = $state(false);
let createSshOpen = $state(false);
let revokeTarget = $state.raw<SshAccessRevokeTarget | null>(null);

const grantsQuery = createQuery(() => ({
	...sshAccessGrantsQueryOptions(detail.sandbox.id),
	enabled: detail.canWrite,
}));
const grants = $derived(grantsQuery.data ?? []);
const create = createMutation(() =>
	createSshAccessMutationOptions(detail.sandbox.id)
);
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
	acknowledged = false;
	createSshOpen = true;
}

function closeCreate() {
	createSshOpen = false;
}

function changeCreateOpen(open: boolean) {
	if (open) return;
	sshAccess = null;
	acknowledged = false;
	sshAccessForm.reset();
}
</script>

{#snippet sshActions()}
	{#if grants.length > 1}
		<Chip
			size="compact"
			disabled={!detail.canWrite}
			onclick={() => {
				revokeTarget = REVOKE_ALL_SSH_ACCESS;
			}}
		>
			Revoke all
		</Chip>
	{/if}
	<Chip
		size="compact"
		leftIcon={Plus}
		disabled={createDisabledReason !== null}
		disabledReason={createDisabledReason ?? undefined}
		onclick={openCreate}
	>
		Create temporary access
	</Chip>
{/snippet}

<SettingsSection
	title="SSH access"
	description="A temporary command grants terminal access until it expires. Creating a new one replaces the active one."
	action={sshActions}
>
	{#each grants as grant (grant.id)}
		<SettingsResourceRow
			icon={KeyRound}
			title={`Expires ${formatDateTime(grant.expiresAt)}`}
			meta={`Created ${formatDateTime(grant.createdAt)}`}
		>
			{#snippet trailing()}
				<Chip
					size="compact"
					disabled={!detail.canWrite}
					onclick={() => {
						revokeTarget = grant;
					}}
				>
					Revoke
				</Chip>
			{/snippet}
		</SettingsResourceRow>
	{:else}
		<p data-settings-row="" class="text-(--text-muted) text-sm">
			No active access
		</p>
	{/each}
</SettingsSection>
<ChipModal
	bind:open={createSshOpen}
	onOpenChange={changeCreateOpen}
	onsubmit={formSubmitHandler(sshAccessForm)}
	dismissDisabled={sshAccess !== null && !acknowledged}
	srTitle="Create SSH access"
	variant="sheet"
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
			<LabeledCheckbox
				checked={acknowledged}
				onCheckedChange={(checked) => (acknowledged = checked)}
			>
				I copied the SSH command
			</LabeledCheckbox>
		{:else}
			<sshAccessForm.AppField name="expiryMinutes">
				{#snippet children(field)}
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
		{#snippet primaryAction(initialFocus)}
			{#if sshAccess}
				<Chip
					variant="primary"
					disabled={!acknowledged}
					onclick={closeCreate}
					{@attach initialFocus}
				>
					Done
				</Chip>
			{:else}
				<Chip
					loading={create.isPending}
					type="submit"
					variant="primary"
					disabled={create.isPending}
					{@attach initialFocus}
				>
					Create
				</Chip>
			{/if}
		{/snippet}
	</ChipModalFooter>
</ChipModal>
<RevokeSshAccessModal
	target={revokeTarget}
	sandboxId={detail.sandbox.id}
	onClose={() => (revokeTarget = null)}
/>
