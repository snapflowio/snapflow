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
</script>

<script lang="ts">
import type { AdminUser } from '@snapflow/api-client';
import type { HeaderAction } from '#lib/components/page/header-actions.ts';
import SettingsField from '#lib/components/settings/settings-field.svelte';
import SettingsPage from '#lib/components/settings/settings-page.svelte';
import SettingsPreferenceRow from '#lib/components/settings/settings-preference-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipCopyInput from '#lib/components/ui/chip/chip-copy-input.svelte';
import ChipDropdown from '#lib/components/ui/chip/chip-dropdown.svelte';
import {
	type AdminUserActions,
	isAdminUser,
	secondFactorLabel,
} from '#lib/features/admin/state/admin-user-actions.svelte.ts';
import { formatDateTime } from '#lib/utils/format.ts';

interface UserDetailsProps {
	user: AdminUser;
	actions: AdminUserActions;
	onBack: () => void;
}

let { user, actions, onBack }: UserDetailsProps = $props();

const roleId = $props.id();
const self = $derived(actions.isSelf(user));
const currentRole = $derived(
	isAdminUser(user) ? AUTH_ROLE.ADMIN : AUTH_ROLE.USER
);
const impersonating = $derived(actions.impersonatingId === user.id);
const headerActions: HeaderAction[] = $derived([
	{
		id: 'impersonate',
		label: 'Impersonate',
		onSelect: () => actions.startImpersonation(user),
		pending: impersonating,
		pendingLabel: 'Switching...',
		disabled: actions.impersonatingId !== null,
		visible: !self,
	},
	{
		id: 'delete',
		kind: 'delete',
		label: 'Delete',
		onSelect: () => actions.open('remove', user),
		visible: !self,
	},
]);
const banCaption = $derived.by(() => {
	if (!user.banned) return 'Blocks sign-in and ends every active session.';
	const ends = user.banExpires
		? `Ends ${formatDateTime(user.banExpires)}`
		: 'Until unbanned';
	return user.banReason ? `${user.banReason} · ${ends}` : ends;
});
</script>

<SettingsPage
	title={user.name || user.email}
	back={{ label: 'Users', onSelect: onBack }}
	actions={headerActions}
>
	<SettingsSection title="Profile">
		{#snippet accessory()}
			<Badge size="sm" variant={user.banned ? 'red' : 'green'}>
				{user.banned ? 'Banned' : 'Active'}
			</Badge>
		{/snippet}
		<div class="grid gap-x-6 gap-y-5 sm:grid-cols-2">
			<SettingsField label="Name" value={user.name} />
			<SettingsField label="Email" value={user.email} />
			<SettingsField
				label="Email verified"
				value={user.emailVerified ? 'Yes' : 'No'}
			/>
			<SettingsField label="Joined" value={formatDateTime(user.createdAt)} />
		</div>
	</SettingsSection>
	<SettingsSection title="User ID">
		<ChipCopyInput value={user.id} copyLabel="Copy user ID" class="font-mono" />
	</SettingsSection>
	<SettingsSection title="Access">
		<div class="flex flex-col gap-5">
			<SettingsPreferenceRow
				label="Platform role"
				caption="Admins can open the admin area and impersonate any user."
				for={roleId}
			>
				<ChipDropdown
					id={roleId}
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
			</SettingsPreferenceRow>
			<SettingsPreferenceRow label="Ban" caption={banCaption}>
				<div class="flex justify-end">
					{#if user.banned}
						<Chip
							disabled={self || actions.unban.isPending}
							onclick={() => actions.unban.mutate(user)}
						>
							{actions.unban.isPending ? 'Unbanning...' : 'Unban'}
						</Chip>
					{:else}
						<Chip disabled={self} onclick={() => actions.open('ban', user)}>
							Ban
						</Chip>
					{/if}
				</div>
			</SettingsPreferenceRow>
		</div>
	</SettingsSection>
	<SettingsSection title="Security">
		<div class="flex flex-col gap-5">
			<SettingsField label="Second factor" value={secondFactorLabel(user)} />
			<SettingsPreferenceRow
				label="Sessions"
				caption="Ends every active session on every device."
			>
				<div class="flex justify-end">
					<Chip
						disabled={self}
						onclick={() => actions.open('revokeSessions', user)}
					>
						Sign out everywhere
					</Chip>
				</div>
			</SettingsPreferenceRow>
		</div>
	</SettingsSection>
</SettingsPage>
