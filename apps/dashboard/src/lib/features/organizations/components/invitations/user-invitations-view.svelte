<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { parseOrganizationRoles } from '@snapflow/organization-access';
import { INVITATION_RESPONSE } from '#lib/api/organizations/invitations.ts';
import FeedbackState from '#lib/components/feedback-state.svelte';
import SettingsPage from '#lib/components/settings/settings-page.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipTag from '#lib/components/ui/chip/chip-tag.svelte';
import MemberRow from '#lib/features/organizations/components/members/member-row.svelte';
import { UserInvitations } from '#lib/features/organizations/state/user-invitations.svelte.ts';
import { formatDate } from '#lib/utils/format.ts';
import { formatOrganizationRoles } from '#lib/utils/organization-roles.ts';

const page = new UserInvitations();
</script>

<SettingsPage
	title="Invitations"
	description="Organizations that invited you to join."
>
	{#if page.invitationsQuery.isPending}
		<FeedbackState variant="inline">Loading invitations...</FeedbackState>
	{:else if page.invitationsQuery.isError &&
		page.invitationsQuery.data === undefined}
		<FeedbackState
			class="flex-1"
			tone="error"
			retrying={page.invitationsQuery.isFetching}
			onRetry={() => void page.invitationsQuery.refetch()}
		>
			Failed to load invitations
		</FeedbackState>
	{:else if page.invitations.length === 0}
		<FeedbackState class="flex-1">No pending invitations</FeedbackState>
	{:else}
		<SettingsSection title={`Pending (${page.invitations.length})`}>
			<div class="-mx-2 flex flex-col gap-y-0.5">
				{#each page.invitations as invitation (invitation.id)}
					{#snippet roleControl()}
						<ChipTag variant="mono">
							{formatOrganizationRoles(parseOrganizationRoles(invitation.role))}
						</ChipTag>
					{/snippet}
					{#snippet menu()}
						<div class="flex shrink-0 items-center gap-1">
							<Chip
								disabled={page.respondMutation.isPending}
								onclick={() =>
									page.answer({
										invitationId: invitation.id,
										response: INVITATION_RESPONSE.REJECT,
									})}
							>
								Decline
							</Chip>
							<Chip
								variant="primary"
								disabled={page.respondMutation.isPending}
								onclick={() =>
									page.answer({
										invitationId: invitation.id,
										response: INVITATION_RESPONSE.ACCEPT,
									})}
							>
								Accept
							</Chip>
						</div>
					{/snippet}
					<MemberRow
						name={invitation.organizationName}
						email={invitation.organizationName}
						status={`Expires ${formatDate(invitation.expiresAt)}`}
						{roleControl}
						{menu}
					/>
				{/each}
			</div>
		</SettingsSection>
	{/if}
</SettingsPage>
