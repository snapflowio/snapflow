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
const META_SEPARATOR = ' · ';
const SYNCED_LABEL = 'Synced';
const UNSUPPORTED_REASON = "This browser doesn't support passkeys";
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
import type { Passkey } from '@better-auth/passkey/client';
import KeyRound from '@lucide/svelte/icons/key-round';
import Pencil from '@lucide/svelte/icons/pencil';
import Plus from '@lucide/svelte/icons/plus';
import { RecoveryStatus } from '@snapflow/api-client';
import { revalidateLogic } from '@tanstack/svelte-form';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	addPasskeyMutationOptions,
	deletePasskeyMutationOptions,
	passkeysQueryOptions,
	renamePasskeyMutationOptions,
} from '#lib/api/account/passkeys.ts';
import { userWalletQueryOptions } from '#lib/api/settlement/user-wallet-queries.ts';
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
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import Skeleton, {
	SKELETON_SECTION_ROWS,
} from '#lib/components/ui/skeleton/skeleton.svelte';
import { passkeyLabel } from '#lib/features/account/state/passkey-label.svelte.ts';
import { supportsPasskeys } from '#lib/features/auth/lib/sign-in/passkey-support.ts';
import SettingsGroupCell from '#lib/features/organizations/components/settings/settings-group-cell.svelte';
import { relativeTimeLabel } from '#lib/features/organizations/lib/relative-time.ts';

const passkeysQuery = createQuery(() => passkeysQueryOptions());
const addPasskey = createMutation(() => addPasskeyMutationOptions());
const renamePasskey = createMutation(() => renamePasskeyMutationOptions());
const removePasskey = createMutation(() => deletePasskeyMutationOptions());
const wallet = createQuery(() => userWalletQueryOptions());
const passkeysSupported = supportsPasskeys();
const passkeys = $derived(passkeysQuery.data ?? []);
const renameId = $props.id();
let addOpen = $state(false);
let renaming = $state.raw<PasskeyRow | null>(null);
let renameDraft = $state('');
let pendingDelete = $state.raw<PasskeyRow | null>(null);
const walletPasskeyLocked = $derived(
	wallet.data?.passkeyId === pendingDelete?.id &&
		wallet.data?.recoveryStatus !== RecoveryStatus.Active
);
const renameTrimmed = $derived(renameDraft.trim());

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

function passkeyMeta(passkey: Passkey): string {
	const parts = [`Added ${relativeTimeLabel(passkey.createdAt)}`];
	if (passkey.backedUp) parts.push(SYNCED_LABEL);
	return parts.join(META_SEPARATOR);
}

function closeAdd(): void {
	addOpen = false;
	form.reset();
}

function startRename(row: PasskeyRow): void {
	renameDraft = row.name;
	renaming = row;
}

function closeRename(open: boolean): void {
	if (!open && !renamePasskey.isPending) renaming = null;
}

async function saveRename(): Promise<void> {
	if (!renaming || !renameTrimmed || renameTrimmed === renaming.name) return;
	const { id } = renaming;
	if (
		await submitMutation(() =>
			renamePasskey.mutateAsync({ id, name: renameTrimmed })
		)
	) {
		renaming = null;
	}
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

<SettingsSection title="Passkeys">
	{#if passkeysQuery.isPending}
		<SettingsGroupCell>
			<Skeleton class="h-10" repeat={SKELETON_SECTION_ROWS} fade />
		</SettingsGroupCell>
	{:else if passkeysQuery.isError}
		<FeedbackState
			variant="inline"
			tone="error"
			resource="passkeys"
			error={passkeysQuery.error}
			retrying={passkeysQuery.isFetching}
			onRetry={() => void passkeysQuery.refetch()}
		/>
	{:else}
		{#each passkeys as passkey (passkey.id)}
			{const name = $derived(passkeyLabel(passkey))}
			<SettingsResourceRow
				title={name}
				meta={passkeyMeta(passkey)}
				icon={KeyRound}
				actionsLabel={`${name} actions`}
				actions={[
					{
						icon: Pencil,
						label: 'Rename',
						onSelect: () => startRename({ id: passkey.id, name }),
					},
					{
						icon: Trash,
						label: 'Remove',
						destructive: true,
						disabled:
							removePasskey.isPending && removePasskey.variables === passkey.id,
						onSelect: () => (pendingDelete = { id: passkey.id, name }),
					},
				]}
			/>
		{:else}
			<SettingsGroupCell tone="muted">
				You don't have any passkeys yet.
			</SettingsGroupCell>
		{/each}
		<SettingsGroupCell>
			<Chip
				variant="secondary"
				size="compact"
				leftIcon={Plus}
				onclick={() => (addOpen = true)}
				disabledReason={passkeysSupported ? undefined : UNSUPPORTED_REASON}
			>
				Add passkey
			</Chip>
		</SettingsGroupCell>
	{/if}
</SettingsSection>

<ChipModal
	bind:open={addOpen}
	onOpenChange={(open) => {
		if (!open) form.reset();
	}}
	onsubmit={formSubmitHandler(form)}
	srTitle="Add passkey"
	variant="sheet"
>
	<ChipModalHeader onClose={closeAdd}>Add passkey</ChipModalHeader>
	<ChipModalBody>
		<p class="text-(--text-secondary) text-sm">
			Your browser asks you to use this device, a password manager or a security
			key.
		</p>
		{#if wallet.data === null}
			<p class="text-(--text-secondary) text-sm">
				This passkey also creates your Snapflow wallet.
			</p>
		{/if}
		<form.AppField name="name">
			{#snippet children(field)}
				<field.TextField
					id="passkey-name"
					label="Name"
					placeholder="MacBook Touch ID"
					autocomplete="off"
					maxlength={PASSKEY_NAME_MAXIMUM_LENGTH}
				/>
			{/snippet}
		</form.AppField>
	</ChipModalBody>
	<form.Subscribe selector={(state) => state.isSubmitting}>
		{#snippet children(isSubmitting)}
			<ChipModalFooter onCancel={closeAdd} cancelDisabled={isSubmitting}>
				{#snippet primaryAction()}
					<Chip loading={isSubmitting} type="submit" variant="primary">
						Continue
					</Chip>
				{/snippet}
			</ChipModalFooter>
		{/snippet}
	</form.Subscribe>
</ChipModal>

<ChipModal
	bind:open={() => renaming !== null, closeRename}
	onsubmit={() => void saveRename()}
	dismissDisabled={renamePasskey.isPending}
	srTitle="Rename passkey"
	variant="sheet"
>
	<ChipModalHeader onClose={() => closeRename(false)}>
		Rename passkey
	</ChipModalHeader>
	<ChipModalBody>
		<ChipModalField label="Name" for={renameId} required>
			<ChipInput
				id={renameId}
				bind:value={renameDraft}
				maxlength={PASSKEY_NAME_MAXIMUM_LENGTH}
				autocomplete="off"
			/>
		</ChipModalField>
	</ChipModalBody>
	<ChipModalFooter cancelDisabled={renamePasskey.isPending}>
		{#snippet primaryAction()}
			<Chip
				type="submit"
				variant="primary"
				loading={renamePasskey.isPending}
				disabled={!renameTrimmed || renameTrimmed === renaming?.name}
			>
				Save
			</Chip>
		{/snippet}
	</ChipModalFooter>
</ChipModal>

<ChipModalConfirm
	bind:open={() => pendingDelete !== null, closeDelete}
	onsubmit={() => void deletePendingPasskey()}
	title="Remove passkey"
	text={walletPasskeyLocked
		? [
				{ text: pendingDelete?.name ?? 'This passkey', bold: true },
				' owns your wallet. ',
				{ text: 'Set up wallet recovery before you remove it.', error: true },
			]
		: [
				{ text: pendingDelete?.name ?? 'This passkey', bold: true },
				' can no longer sign in to your account.',
			]}
	pending={removePasskey.isPending}
>
	{#snippet confirm()}
		<Chip
			loading={removePasskey.isPending}
			type="submit"
			variant="destructive"
			disabledReason={walletPasskeyLocked
				? 'Set up wallet recovery first'
				: undefined}
		>
			Remove
		</Chip>
	{/snippet}
</ChipModalConfirm>
