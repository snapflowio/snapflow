<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { parseOrganizationRoles } from '@snapflow/organization-access';
import type { UserInvitation } from '#lib/api/organizations/invitations.ts';
import { relativeTimeLabel } from '#lib/features/organizations/lib/relative-time.ts';
import { formatOrganizationRoles } from '#lib/utils/organization-roles.ts';

const META_SEPARATOR = ' · ';

function invitationMeta(invitation: UserInvitation): string {
	return [
		`Invited ${relativeTimeLabel(invitation.createdAt)}`,
		formatOrganizationRoles(parseOrganizationRoles(invitation.role)),
	].join(META_SEPARATOR);
}
</script>

<script lang="ts">
import Mail from '@lucide/svelte/icons/mail';
import { INVITATION_RESPONSE } from '#lib/api/organizations/invitations.ts';
import EmptyState from '#lib/components/empty-state.svelte';
import FeedbackState from '#lib/components/feedback-state.svelte';
import SettingsPage from '#lib/components/settings/settings-page.svelte';
import SettingsResourceRow from '#lib/components/settings/settings-resource-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import IdentityTile from '#lib/components/ui/avatar/identity-tile.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Skeleton, {
	SKELETON_SECTION_ROWS,
} from '#lib/components/ui/skeleton/skeleton.svelte';
import { UserInvitations } from '#lib/features/organizations/state/user-invitations.svelte.ts';

const page = new UserInvitations();
const answering = $derived(
	page.respondMutation.isPending
		? (page.respondMutation.variables ?? null)
		: null
);
</script>

<SettingsPage title="Invitations">
	{#if page.invitationsQuery.isPending}
		<Skeleton class="h-14" repeat={SKELETON_SECTION_ROWS} fade />
	{:else if page.invitationsQuery.isError &&
		page.invitationsQuery.data === undefined}
		<FeedbackState
			class="flex-1"
			tone="error"
			resource="invitations"
			error={page.invitationsQuery.error}
			retrying={page.invitationsQuery.isFetching}
			onRetry={() => void page.invitationsQuery.refetch()}
		/>
	{:else if page.invitations.length === 0}
		<EmptyState
			icon={Mail}
			title="No pending invitations"
			description="Invitations to join an organization show up here."
		/>
	{:else}
		<SettingsSection title={`Pending (${page.invitations.length})`}>
			{#each page.invitations as invitation, index (invitation.id)}
				{const busy = $derived(answering?.invitationId === invitation.id)}
				{#snippet tile()}
					<IdentityTile name={invitation.organizationName} size="md" />
				{/snippet}
				{#snippet trailing()}
					<div class="flex shrink-0 items-center gap-2">
						<Chip
							variant="secondary"
							size="compact"
							loading={busy &&
								answering?.response === INVITATION_RESPONSE.REJECT}
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
							variant={index === 0 ? 'primary' : 'secondary'}
							size="compact"
							loading={busy &&
								answering?.response === INVITATION_RESPONSE.ACCEPT}
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
				<SettingsResourceRow
					title={invitation.organizationName}
					meta={invitationMeta(invitation)}
					{tile}
					{trailing}
				/>
			{/each}
		</SettingsSection>
	{/if}
</SettingsPage>
