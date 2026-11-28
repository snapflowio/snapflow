<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { AUTH_ROLE } from '#lib/api/auth/role.ts';

const ROLE_OPTIONS = [
	{ label: 'Admin', value: AUTH_ROLE.ADMIN },
	{ label: 'User', value: AUTH_ROLE.USER },
];
const SELF_REASON = 'You cannot change your own account here';
const BAN_INFO = 'Blocks sign-in and ends every active session.';
const UNTIL_UNBANNED = 'Until unbanned';
const YES = 'Yes';
const NO = 'No';
</script>

<script lang="ts">
import type { AdminUser } from '@snapflow/api-client';
import PanelSection from '#lib/components/detail/panel-section.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import SettingsRow from '#lib/components/settings/settings-row.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipDropdown from '#lib/components/ui/chip/chip-dropdown.svelte';
import { ADMIN_PANEL_GROUP_CLASS } from '#lib/features/admin/lib/admin-layout.ts';
import {
	type AdminUserActions,
	isAdminUser,
	secondFactorLabel,
} from '#lib/features/admin/state/admin-user-actions.svelte.ts';
import { formatDateTime } from '#lib/utils/format.ts';

interface UserDetailsProps {
	user: AdminUser;
	actions: AdminUserActions;
}

let { user, actions }: UserDetailsProps = $props();

const self = $derived(actions.isSelf(user));
const selfReason = $derived(self ? SELF_REASON : undefined);
const currentRole = $derived(
	isAdminUser(user) ? AUTH_ROLE.ADMIN : AUTH_ROLE.USER
);
const banInfo = $derived.by(() => {
	if (!user.banned) return BAN_INFO;
	const ends = user.banExpires
		? `Ends ${formatDateTime(user.banExpires)}`
		: UNTIL_UNBANNED;
	return user.banReason ? `${user.banReason} · ${ends}` : ends;
});
</script>

<div class="flex flex-col">
	<PanelSection title="Profile">
		<KeyValueList framed={false}>
			<KeyValueRow label="Status">
				<Badge size="sm" variant={user.banned ? 'error' : 'success'}>
					{user.banned ? 'Banned' : 'Active'}
				</Badge>
			</KeyValueRow>
			<KeyValueRow label="Name" value={user.name} />
			<KeyValueRow label="Email" value={user.email} copy={user.email} />
			<KeyValueRow
				label="Email verified"
				value={user.emailVerified ? YES : NO}
			/>
			<KeyValueRow label="Second factor" value={secondFactorLabel(user)} />
			<KeyValueRow label="Joined" value={formatDateTime(user.createdAt)} />
		</KeyValueList>
	</PanelSection>
	<PanelSection title="Access">
		<div class={ADMIN_PANEL_GROUP_CLASS}>
			<SettingsRow
				layout="stacked"
				label="Platform role"
				description="Admins can open the admin area and impersonate any user."
				disabledReason={selfReason}
			>
				{#snippet control(controlId)}
					<ChipDropdown
						id={controlId}
						fullWidth
						align="start"
						disabled={self}
						options={ROLE_OPTIONS}
						bind:value={
							() => currentRole,
							(role) => {
	if (role !== undefined && role !== currentRole) {
		actions.open('role', user);
	}
}
						}
					/>
				{/snippet}
			</SettingsRow>
			<SettingsRow layout="stacked" label="Ban" description={banInfo}>
				{#if user.banned}
					<Chip
						variant="secondary"
						size="compact"
						loading={actions.unban.isPending}
						disabledReason={selfReason}
						onclick={() => actions.unban.mutate(user)}
					>
						Unban
					</Chip>
				{:else}
					<Chip
						variant="secondary"
						size="compact"
						disabledReason={selfReason}
						onclick={() => actions.open('ban', user)}
					>
						Ban
					</Chip>
				{/if}
			</SettingsRow>
			<SettingsRow
				layout="stacked"
				label="Sessions"
				description="Ends every active session on every device."
			>
				<Chip
					variant="secondary"
					size="compact"
					disabledReason={selfReason}
					onclick={() => actions.open('revokeSessions', user)}
				>
					Sign out everywhere
				</Chip>
			</SettingsRow>
		</div>
	</PanelSection>
</div>
