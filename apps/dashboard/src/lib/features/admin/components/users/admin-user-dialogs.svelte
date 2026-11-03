<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import {
	type AdminUserActions,
	isAdminUser,
} from '#lib/features/admin/state/admin-user-actions.svelte.ts';
import BanUserModal from './ban-user-modal.svelte';

interface AdminUserDialogsProps {
	actions: AdminUserActions;
}

let { actions }: AdminUserDialogsProps = $props();

const dialog = $derived(actions.dialog);
const email = $derived(dialog?.user.email ?? 'this user');
const demoting = $derived(dialog ? isAdminUser(dialog.user) : false);

function setDialogOpen(open: boolean) {
	if (!open) actions.close();
}
</script>

<ChipModalConfirm
	bind:open={() => dialog?.kind === 'role', setDialogOpen}
	title={demoting ? 'Demote user' : 'Promote user'}
	text={[
		demoting ? 'Demoting ' : 'Promoting ',
		{ text: email, bold: true },
		' ',
		demoting
			? { text: 'revokes their platform admin access.', error: true }
			: 'grants full platform admin access, including impersonating any user.',
	]}
	pending={actions.setRole.isPending}
	onsubmit={actions.confirmRole}
>
	{#snippet confirm()}
		<ChipModalAction
			type="submit"
			variant={demoting ? 'destructive' : 'primary'}
			disabled={actions.setRole.isPending}
		>
			{#if actions.setRole.isPending}
				{demoting ? 'Demoting...' : 'Promoting...'}
			{:else}
				{demoting ? 'Demote' : 'Promote'}
			{/if}
		</ChipModalAction>
	{/snippet}
</ChipModalConfirm>

<ChipModalConfirm
	bind:open={() => dialog?.kind === 'revokeSessions', setDialogOpen}
	title="Sign out everywhere"
	text={[
		'Signing out ',
		{ text: email, bold: true },
		' ',
		{ text: 'ends every active session immediately.', error: true },
	]}
	pending={actions.revokeSessions.isPending}
	onsubmit={actions.confirmRevokeSessions}
>
	{#snippet confirm()}
		<ChipModalAction
			type="submit"
			variant="destructive"
			disabled={actions.revokeSessions.isPending}
		>
			{actions.revokeSessions.isPending ? 'Signing out...' : 'Sign out'}
		</ChipModalAction>
	{/snippet}
</ChipModalConfirm>

<ChipModalConfirm
	bind:open={() => dialog?.kind === 'remove', setDialogOpen}
	title="Delete user"
	text={[
		'Are you sure you want to delete ',
		{ text: email, bold: true },
		'? ',
		{
			text: 'Their account and sessions are permanently removed.',
			error: true,
		},
	]}
	pending={actions.remove.isPending}
	onsubmit={actions.confirmRemove}
>
	{#snippet confirm()}
		<ChipModalAction
			type="submit"
			variant="destructive"
			disabled={actions.remove.isPending}
		>
			{actions.remove.isPending ? 'Deleting...' : 'Delete'}
		</ChipModalAction>
	{/snippet}
</ChipModalConfirm>

<BanUserModal
	user={dialog?.kind === 'ban' ? dialog.user : null}
	pending={actions.ban.isPending}
	onBan={actions.confirmBan}
	onClose={actions.close}
/>
