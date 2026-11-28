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
import Mail from '@lucide/svelte/icons/mail';
import Send from '@lucide/svelte/icons/send';
import type { OrganizationInvitation } from '#lib/api/organizations/invitations.ts';
import SettingsResourceRow from '#lib/components/settings/settings-resource-row.svelte';
import { invitationDetail } from '#lib/features/organizations/lib/members-page.ts';
import type { MembersPage } from '#lib/features/organizations/state/members-page.svelte.ts';

let {
	page,
	invitation,
}: { page: MembersPage; invitation: OrganizationInvitation } = $props();
</script>

<SettingsResourceRow
	title={invitation.email}
	meta={invitationDetail(invitation)}
	icon={Mail}
	actionsLabel={`Invitation for ${invitation.email} actions`}
	actions={[
		{
			icon: Send,
			label: 'Resend',
			visible: page.canInvite,
			disabled:
				page.resendMutation.isPending &&
				page.resendMutation.variables?.id === invitation.id,
			onSelect: () => page.resendInvitation(invitation),
		},
		{
			icon: Copy,
			label: 'Copy email',
			onSelect: () => page.copyEmail(invitation.email),
		},
		{
			icon: Ban,
			label: 'Revoke',
			destructive: true,
			visible: page.canCancel,
			onSelect: () => (page.revoking = invitation),
		},
	]}
/>
