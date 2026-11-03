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

const PASSKEY_NAME_MAXIMUM_LENGTH = 100;
const passkeySchema = z.object({
	name: z
		.string()
		.trim()
		.max(
			PASSKEY_NAME_MAXIMUM_LENGTH,
			`Name must be ${PASSKEY_NAME_MAXIMUM_LENGTH} characters or fewer`
		),
});

interface PasskeyRow {
	id: string;
	name: string;
}
</script>

<script lang="ts">
import { getAuthenticatorName } from '@better-auth/passkey';
import type { Passkey } from '@better-auth/passkey/client';
import Plus from '@lucide/svelte/icons/plus';
import { revalidateLogic } from '@tanstack/svelte-form';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	addPasskeyMutationOptions,
	deletePasskeyMutationOptions,
	passkeysQueryOptions,
} from '#lib/api/account/passkeys.ts';
import FeedbackState from '#lib/components/feedback-state.svelte';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import {
	formSubmitHandler,
	submitMutation,
} from '#lib/components/form/submit.ts';
import Trash from '#lib/components/icons/trash.svelte';
import SettingsResourceRow from '#lib/components/settings/settings-resource-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import { supportsPasskeys } from '#lib/features/auth/lib/sign-in/passkey-support.ts';
import { formatDate } from '#lib/utils/format.ts';
import AccountRowMenu from './account-row-menu.svelte';

const passkeysQuery = createQuery(() => passkeysQueryOptions());
const addPasskey = createMutation(() => addPasskeyMutationOptions());
const removePasskey = createMutation(() => deletePasskeyMutationOptions());
const passkeysSupported = supportsPasskeys();
const passkeys = $derived(passkeysQuery.data ?? []);
let addOpen = $state(false);
let pendingDelete = $state.raw<PasskeyRow | null>(null);

const form = createAppForm(() => ({
	defaultValues: { name: '' },
	validationLogic: revalidateLogic(),
	validators: { onDynamic: passkeySchema },
	onSubmit: async ({ value }) => {
		if (
			await submitMutation(() =>
				addPasskey.mutateAsync(value.name.trim() || undefined)
			)
		) {
			addOpen = false;
		}
	},
}));

function passkeyName(passkey: Passkey): string {
	return passkey.name || getAuthenticatorName(passkey.aaguid) || 'Passkey';
}

function closeAdd(): void {
	addOpen = false;
	form.reset();
}

function closeDelete(open: boolean): void {
	if (!open) pendingDelete = null;
}

async function deletePendingPasskey(): Promise<void> {
	if (!pendingDelete) return;
	const { id } = pendingDelete;
	if (await submitMutation(() => removePasskey.mutateAsync(id))) {
		pendingDelete = null;
	}
}
</script>

{#snippet addAction()}
	<Chip
		leftIcon={Plus}
		onclick={() => (addOpen = true)}
		disabled={!passkeysSupported}
		title={passkeysSupported
			? undefined
			: 'Passkeys are not supported by this browser'}
	>
		Add passkey
	</Chip>
{/snippet}

<SettingsSection title="Passkeys" action={addAction}>
	{#if passkeysQuery.isPending}
		<FeedbackState variant="inline">Loading passkeys...</FeedbackState>
	{:else if passkeysQuery.isError}
		<FeedbackState
			variant="inline"
			tone="error"
			message="Failed to load passkeys"
			retrying={passkeysQuery.isFetching}
			onRetry={() => void passkeysQuery.refetch()}
		/>
	{:else if passkeys.length === 0}
		<FeedbackState variant="inline">No passkeys yet</FeedbackState>
	{:else}
		<div class="flex flex-col gap-y-0.5">
			{#each passkeys as passkey (passkey.id)}
				{const name = $derived(passkeyName(passkey))}
				{#snippet menu()}
					<AccountRowMenu
						label="Passkey actions"
						actions={[
							{
								icon: Trash,
								label: 'Remove',
								destructive: true,
								disabled:
									removePasskey.isPending &&
									removePasskey.variables === passkey.id,
								onSelect: () => (pendingDelete = { id: passkey.id, name }),
							},
						]}
					/>
				{/snippet}
				<SettingsResourceRow
					title={name}
					description={`Added ${formatDate(passkey.createdAt)}${passkey.backedUp ? ' · Synced' : ''}`}
					trailing={menu}
				/>
			{/each}
		</div>
	{/if}
</SettingsSection>

<ChipModal
	bind:open={addOpen}
	onOpenChange={(open) => {
		if (!open) form.reset();
	}}
	onsubmit={formSubmitHandler(form)}
	srTitle="Add passkey"
>
	<ChipModalHeader onClose={closeAdd}>Add passkey</ChipModalHeader>
	<ChipModalBody>
		<p class="px-2 text-(--text-secondary) text-sm">
			Your browser will ask you to use this device, a password manager, or a
			hardware security key.
		</p>
		<form.AppField name="name">
			{#snippet children(
				field
			)}
				<field.TextField
					id="passkey-name"
					label="Name"
					placeholder="e.g., MacBook Touch ID"
					autocomplete="off"
					maxlength={PASSKEY_NAME_MAXIMUM_LENGTH}
				/>
			{/snippet}
		</form.AppField>
	</ChipModalBody>
	<form.Subscribe selector={(state) => state.isSubmitting}>
		{#snippet children(
			isSubmitting
		)}
			<ChipModalFooter onCancel={closeAdd} cancelDisabled={isSubmitting}>
				{#snippet primaryAction()}
					<ChipModalAction
						type="submit"
						variant="primary"
						disabled={isSubmitting}
					>
						{isSubmitting ? 'Waiting...' : 'Continue'}
					</ChipModalAction>
				{/snippet}
			</ChipModalFooter>
		{/snippet}
	</form.Subscribe>
</ChipModal>

<ChipModalConfirm
	bind:open={() => pendingDelete !== null, closeDelete}
	onsubmit={() => void deletePendingPasskey()}
	title="Remove passkey"
	text={[
		'Removing ',
		{ text: pendingDelete?.name ?? 'this passkey', bold: true },
		' ',
		{ text: 'means it can no longer sign in to your account.', error: true },
	]}
	pending={removePasskey.isPending}
>
	{#snippet confirm()}
		<ChipModalAction
			type="submit"
			variant="destructive"
			disabled={!pendingDelete || removePasskey.isPending}
		>
			{removePasskey.isPending ? 'Removing...' : 'Remove'}
		</ChipModalAction>
	{/snippet}
</ChipModalConfirm>
