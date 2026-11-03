<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Ban from '@lucide/svelte/icons/ban';
import Copy from '@lucide/svelte/icons/copy';
import type { OrganizationInvitation } from '#lib/api/organizations/invitations.ts';
import ChipTag from '#lib/components/ui/chip/chip-tag.svelte';
import MemberRow from '#lib/features/organizations/components/members/member-row.svelte';
import RowActionsMenu from '#lib/features/organizations/components/settings/row-actions-menu.svelte';
import { invitationRoleLabel } from '#lib/features/organizations/lib/members-page.ts';
import type { MembersPage } from '#lib/features/organizations/state/members-page.svelte.ts';

let {
	page,
	invitation,
}: { page: MembersPage; invitation: OrganizationInvitation } = $props();
</script>

{#snippet roleControl()}
	<ChipTag variant="mono">{invitationRoleLabel(invitation)}</ChipTag>
{/snippet}
{#snippet menu()}
	<RowActionsMenu
		label="Invitation actions"
		actions={[
			{
				icon: Copy,
				label: 'Copy email',
				onSelect: () => page.copyEmail(invitation.email),
			},
			{
				icon: Ban,
				label: 'Revoke invite',
				destructive: true,
				visible: page.canCancel,
				onSelect: () => (page.revoking = invitation),
			},
		]}
	/>
{/snippet}
<MemberRow
	name={invitation.email}
	email={invitation.email}
	status="Invite pending"
	{roleControl}
	{menu}
/>
