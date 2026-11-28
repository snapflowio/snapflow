<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Search from '@lucide/svelte/icons/search';
import EmptyState from '#lib/components/empty-state.svelte';
import FeedbackState from '#lib/components/feedback-state.svelte';
import SettingsPage from '#lib/components/settings/settings-page.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Skeleton, {
	SKELETON_SECTION_ROWS,
} from '#lib/components/ui/skeleton/skeleton.svelte';
import MembersPageDialogs from '#lib/features/organizations/components/members/members-page-dialogs.svelte';
import MembersTable from '#lib/features/organizations/components/members/members-table.svelte';
import OrganizationInvitationItem from '#lib/features/organizations/components/members/organization-invitation-item.svelte';
import { MembersPage } from '#lib/features/organizations/state/members-page.svelte.ts';

const page = new MembersPage();
</script>

<SettingsPage
	title="Members"
	search={{
		value: page.search.value,
		onChange: (value) => (page.search.value = value),
		placeholder: 'Search by name or email',
	}}
	actions={page.headerActions}
>
	{#if page.membersQuery.isPending}
		<Skeleton class="h-14" repeat={SKELETON_SECTION_ROWS} fade />
	{:else if page.membersQuery.isError && page.membersQuery.data === undefined}
		<FeedbackState
			class="flex-1"
			tone="error"
			resource="members"
			error={page.membersQuery.error}
			retrying={page.membersQuery.isFetching}
			onRetry={() => void page.membersQuery.refetch()}
		/>
	{:else if page.searching && page.visibleCount === 0}
		<EmptyState icon={Search} title={`No results for “${page.query}”`}>
			{#snippet actions()}
				<Chip variant="secondary" onclick={() => (page.search.value = '')}>
					Clear search
				</Chip>
			{/snippet}
		</EmptyState>
	{:else}
		{#if page.visibleInvitations.length > 0}
			<SettingsSection
				title={`Pending invitations (${page.visibleInvitations.length})`}
			>
				{#each page.visibleInvitations as invitation (invitation.id)}
					<OrganizationInvitationItem {page} {invitation} />
				{/each}
			</SettingsSection>
		{/if}
		{#if page.visibleMembers.length > 0 && page.visibleInvitations.length > 0}
			<SettingsSection title={`Members (${page.visibleMembers.length})`}>
				<MembersTable {page} />
			</SettingsSection>
		{:else if page.visibleMembers.length > 0}
			<MembersTable {page} />
		{/if}
	{/if}
</SettingsPage>

<MembersPageDialogs {page} />
