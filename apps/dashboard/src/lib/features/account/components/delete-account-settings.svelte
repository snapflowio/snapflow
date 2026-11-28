<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const BLOCKED_REASON = 'Resolve the steps above first';
const UNCONFIRMED_REASON = 'Type your email to confirm';

function deleteBlockedReason(
	blocked: boolean,
	ready: boolean
): string | undefined {
	if (blocked) return BLOCKED_REASON;
	return ready ? undefined : UNCONFIRMED_REASON;
}
</script>

<script lang="ts">
import { createQuery, useQueryClient } from '@tanstack/svelte-query';
import { deleteUserAccount } from '#lib/api/auth/account.ts';
import { signOut } from '#lib/api/auth/session.ts';
import { accountDeletionBlockersQueryOptions } from '#lib/api/deletion-blockers.ts';
import { userErrorMessage } from '#lib/api/errors/api-error-details.ts';
import DeletionBlockers from '#lib/components/settings/deletion-blockers.svelte';
import { deletionSteps } from '#lib/components/settings/deletion-blockers.ts';
import SettingsRow from '#lib/components/settings/settings-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

const auth = getAuth();
const queryClient = useQueryClient();
let open = $state(false);
let pending = $state(false);
let errorMessage = $state<string | null>(null);

const blockersQuery = createQuery(() => ({
	...accountDeletionBlockersQueryOptions(),
	enabled: open,
}));
const steps = $derived(
	blockersQuery.data ? deletionSteps(blockersQuery.data) : []
);
const blocked = $derived(!blockersQuery.isSuccess || steps.length > 0);
const email = $derived(auth.user?.email ?? '');

function setOpen(next: boolean): void {
	if (pending) return;
	open = next;
	if (!next) errorMessage = null;
}

async function deleteAccount(): Promise<void> {
	if (blocked || pending) return;
	pending = true;
	errorMessage = null;
	try {
		const deletion = await deleteUserAccount();
		if (deletion.error) {
			errorMessage = userErrorMessage(deletion.error);
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

<SettingsSection>
	<SettingsRow
		label="Delete account"
		description="Permanently deletes your account and every resource it owns."
	>
		<Chip
			variant="destructive-secondary"
			size="compact"
			onclick={() => setOpen(true)}
		>
			Delete
		</Chip>
	</SettingsRow>
</SettingsSection>

<ChipModalConfirm
	bind:open={() => open, setOpen}
	onsubmit={() => void deleteAccount()}
	size="md"
	title="Delete account"
	text={[
		'This permanently deletes ',
		{ text: email, bold: true },
		' and every resource it owns. ',
		{ text: "This can't be undone.", error: true },
	]}
	friction="type-name"
	confirmName={email}
	error={errorMessage}
	{pending}
>
	<DeletionBlockers
		{steps}
		loading={blockersQuery.isPending}
		errorMessage={blockersQuery.isError
			? userErrorMessage(blockersQuery.error)
			: null}
	/>
	{#snippet confirm(ready)}
		<Chip
			loading={pending}
			type="submit"
			variant="destructive"
			disabledReason={deleteBlockedReason(blocked, ready)}
		>
			Delete account
		</Chip>
	{/snippet}
</ChipModalConfirm>
