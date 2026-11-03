<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { useQueryClient } from '@tanstack/svelte-query';
import { deleteUserAccount } from '#lib/api/auth/account.ts';
import { signOut } from '#lib/api/auth/session.ts';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import ChipModalError from '#lib/components/ui/chip-modal/chip-modal-error.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import Label from '#lib/components/ui/label.svelte';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import { accountDeletionErrorMessage } from '#lib/features/account/lib/account-deletion-error.ts';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

const auth = getAuth();
const queryClient = useQueryClient();
const confirmId = $props.id();
let open = $state(false);
let confirmEmail = $state('');
let pending = $state(false);
let errorMessage = $state<string | null>(null);

const email = $derived(auth.user?.email ?? '');
const confirmed = $derived(
	email.length > 0 && confirmEmail.trim().toLowerCase() === email.toLowerCase()
);

function setOpen(next: boolean): void {
	if (pending) return;
	open = next;
	if (!next) {
		confirmEmail = '';
		errorMessage = null;
	}
}

async function deleteAccount(): Promise<void> {
	if (!confirmed || pending) return;
	pending = true;
	errorMessage = null;
	try {
		const deletion = await deleteUserAccount();
		if (deletion.error) {
			errorMessage = accountDeletionErrorMessage(deletion.error);
			return;
		}
		await signOut(queryClient).catch(() => undefined);
		open = false;
		toast.success('Account deleted');
		await goto(resolve(Path.LOGIN), { replace: true });
	} finally {
		pending = false;
	}
}
</script>

<SettingsSection title="Account">
	<div class="flex items-center justify-between gap-4">
		<Label>Delete account</Label>
		<Chip onclick={() => setOpen(true)}>Delete</Chip>
	</div>
</SettingsSection>

<ChipModalConfirm
	bind:open={() => open, setOpen}
	onsubmit={() => void deleteAccount()}
	size="md"
	title="Delete account"
	text={[
		'This permanently deletes ',
		{ text: email, bold: true },
		' along with every resource it owns. Stop running workloads and let their usage settle first. ',
		{ text: 'This cannot be undone.', error: true },
	]}
	{pending}
>
	<ChipModalField label="Confirm your email" for={confirmId} required>
		<ChipInput
			id={confirmId}
			type="email"
			bind:value={confirmEmail}
			placeholder={email}
			autocomplete="off"
			disabled={pending}
		/>
	</ChipModalField>
	<ChipModalError message={errorMessage} />
	{#snippet confirm()}
		<ChipModalAction
			type="submit"
			variant="destructive"
			disabled={pending || !confirmed}
			disabledTooltip={confirmed
				? undefined
				: 'Enter your account email to confirm'}
		>
			{pending ? 'Deleting...' : 'Delete account'}
		</ChipModalAction>
	{/snippet}
</ChipModalConfirm>
