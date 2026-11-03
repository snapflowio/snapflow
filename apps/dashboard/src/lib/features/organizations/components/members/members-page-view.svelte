<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import FeedbackState from '#lib/components/feedback-state.svelte';
import SettingsPage from '#lib/components/settings/settings-page.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import MembersPageDialogs from '#lib/features/organizations/components/members/members-page-dialogs.svelte';
import OrganizationInvitationItem from '#lib/features/organizations/components/members/organization-invitation-item.svelte';
import OrganizationMemberItem from '#lib/features/organizations/components/members/organization-member-item.svelte';
import RolesSection from '#lib/features/organizations/components/roles/roles-section.svelte';
import { MembersPage } from '#lib/features/organizations/state/members-page.svelte.ts';

const page = new MembersPage();
</script>

<SettingsPage
	title="Members"
	description="People with access to this organization and their roles."
	search={{
		value: page.search.value,
		onChange: (value) => (page.search.value = value),
		placeholder: 'Search members...',
	}}
	actions={page.headerActions}
>
	{#if page.membersQuery.isPending}
		<FeedbackState variant="inline">Loading members...</FeedbackState>
	{:else if page.membersQuery.isError && page.membersQuery.data === undefined}
		<FeedbackState
			variant="inline"
			tone="error"
			retrying={page.membersQuery.isFetching}
			onRetry={() => void page.membersQuery.refetch()}
		>
			Failed to load organization members
		</FeedbackState>
	{:else if !page.searching || page.visibleCount > 0}
		<SettingsSection title={`Members (${page.memberCount})`}>
			{#if page.visibleCount === 0}
				<FeedbackState variant="inline">No members yet</FeedbackState>
			{:else}
				<div class="-mx-2 flex flex-col gap-y-0.5">
					{#each page.visibleMembers as member (member.id)}
						<OrganizationMemberItem {page} {member} />
					{/each}
					{#each page.visibleInvitations as invitation (invitation.id)}
						<OrganizationInvitationItem {page} {invitation} />
					{/each}
				</div>
			{/if}
		</SettingsSection>
	{/if}
	{#if page.searching &&
		page.visibleCount === 0 &&
		!page.membersQuery.isPending}
		<FeedbackState variant="inline">
			No members matching “{page.query}”
		</FeedbackState>
	{/if}
	{#if !page.searching}
		<RolesSection
			customRoles={page.customRoles}
			loading={page.rolesQuery.isPending}
			failed={page.rolesQuery.isError}
			retrying={page.rolesQuery.isFetching}
			onRetry={() => void page.rolesQuery.refetch()}
			canUpdate={page.canUpdateRole}
			canDelete={page.canDeleteRole}
			onEdit={(role) => (page.roleEditor = { role })}
			onDelete={(role) => (page.deletingRole = role)}
		/>
	{/if}
</SettingsPage>

<MembersPageDialogs {page} />
