<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { splitMemberRoles } from '#lib/api/organizations/member-roles.ts';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import ChipModalConfirmTarget from '#lib/components/ui/chip-modal/chip-modal-confirm-target.svelte';
import EditMemberRolesModal from '#lib/features/organizations/components/members/edit-member-roles-modal.svelte';
import InviteModal from '#lib/features/organizations/components/members/invite-modal.svelte';
import CustomRoleModal from '#lib/features/organizations/components/roles/custom-role-modal.svelte';
import {
	deleteRoleCopy,
	removeMemberCopy,
	revokeInvitationCopy,
} from '#lib/features/organizations/lib/member-confirm-copy.ts';
import type { MembersPage } from '#lib/features/organizations/state/members-page.svelte.ts';

let { page }: { page: MembersPage } = $props();
</script>

<InviteModal
	bind:open={page.inviteOpen}
	canInvite={page.canInvite}
	onInvite={page.invite}
/>

<EditMemberRolesModal
	bind:open={() => page.editing !== null, page.closeEdit}
	email={page.editing?.user.email ?? ''}
	initialRoles={splitMemberRoles(page.editing?.role ?? '')}
	pending={page.updateRolesMutation.isPending}
	onSave={page.saveRoles}
/>

<ChipModalConfirmTarget
	target={page.removing}
	{...removeMemberCopy(page.removing)}
	pending={page.removeMutation.isPending}
	onCancel={() => (page.removing = null)}
	onConfirm={page.removeMember}
/>

<ChipModalConfirm
	bind:open={page.leaving}
	onsubmit={page.leaveOrganization}
	title="Leave organization"
	text={[
		'Are you sure you want to leave ',
		{ text: page.organizationName ?? 'this organization', bold: true },
		'? ',
		{ text: 'You will lose access to all of its resources.', error: true },
		' This action cannot be undone.',
	]}
	pending={page.leaveMutation.isPending}
>
	{#snippet confirm()}
		<ChipModalAction
			type="submit"
			variant="destructive"
			disabled={page.leaveMutation.isPending}
		>
			{page.leaveMutation.isPending ? 'Leaving...' : 'Leave organization'}
		</ChipModalAction>
	{/snippet}
</ChipModalConfirm>

<ChipModalConfirmTarget
	target={page.revoking}
	{...revokeInvitationCopy(page.revoking)}
	pending={page.cancelMutation.isPending}
	onCancel={() => (page.revoking = null)}
	onConfirm={page.revokeInvitation}
/>

<CustomRoleModal
	bind:open={() => page.roleEditor !== null, page.closeRoleEditor}
	role={page.roleEditor?.role ?? null}
	onSubmit={page.saveRole}
/>

<ChipModalConfirmTarget
	target={page.deletingRole}
	{...deleteRoleCopy(page.deletingRole)}
	pending={page.deleteRoleMutation.isPending}
	onCancel={() => (page.deletingRole = null)}
	onConfirm={page.removeRole}
/>
