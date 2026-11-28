<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const UNKNOWN_IP = 'Unknown IP';

interface SessionRow {
	token: string;
	device: string;
}
</script>

<script lang="ts">
import LogOut from '@lucide/svelte/icons/log-out';
import MonitorSmartphone from '@lucide/svelte/icons/monitor-smartphone';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	revokeOtherSessionsMutationOptions,
	revokeSessionMutationOptions,
	sessionsQueryOptions,
} from '#lib/api/account/sessions.ts';
import FeedbackState from '#lib/components/feedback-state.svelte';
import SettingsResourceRow from '#lib/components/settings/settings-resource-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import Skeleton, {
	SKELETON_SECTION_ROWS,
} from '#lib/components/ui/skeleton/skeleton.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import { deviceLabel } from '#lib/features/account/lib/user-agent.ts';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import SettingsGroupCell from '#lib/features/organizations/components/settings/settings-group-cell.svelte';

const auth = getAuth();
const sessionsQuery = createQuery(() => sessionsQueryOptions());
const revoke = createMutation(() => revokeSessionMutationOptions());
const revokeOthers = createMutation(() => revokeOtherSessionsMutationOptions());
const currentToken = $derived(auth.session?.session.token);
const sessions = $derived(
	[...(sessionsQuery.data ?? [])].sort(
		(left, right) =>
			Number(right.token === currentToken) - Number(left.token === currentToken)
	)
);
const otherCount = $derived(
	sessions.filter((session) => session.token !== currentToken).length
);
let revoking = $state.raw<SessionRow | null>(null);
let signOutOthersOpen = $state(false);

function closeRevoke(open: boolean): void {
	if (!open) revoking = null;
}

function revokeSession(): void {
	if (!revoking) return;
	revoke.mutate(revoking.token, {
		onSuccess: () => {
			revoking = null;
		},
	});
}

function signOutOtherDevices(): void {
	revokeOthers.mutate(undefined, {
		onSuccess: () => {
			signOutOthersOpen = false;
		},
	});
}
</script>

{#snippet currentBadge()}
	<Badge size="pill">This device</Badge>
{/snippet}

<SettingsSection title="Sessions">
	{#if sessionsQuery.isPending}
		<SettingsGroupCell>
			<Skeleton class="h-10" repeat={SKELETON_SECTION_ROWS} fade />
		</SettingsGroupCell>
	{:else if sessionsQuery.isError}
		<FeedbackState
			variant="inline"
			tone="error"
			resource="sessions"
			error={sessionsQuery.error}
			retrying={sessionsQuery.isFetching}
			onRetry={() => void sessionsQuery.refetch()}
		/>
	{:else}
		{#each sessions as session (session.token)}
			{const isCurrent = $derived(session.token === currentToken)}
			{const device = $derived(deviceLabel(session.userAgent))}
			{#snippet sessionMeta()}
				{session.ipAddress || UNKNOWN_IP}
				· signed in
				<Timestamp value={session.createdAt} class="text-(--text-muted)" />
			{/snippet}
			<SettingsResourceRow
				title={device}
				meta={sessionMeta}
				icon={MonitorSmartphone}
				badge={isCurrent ? currentBadge : undefined}
				actions={isCurrent
					? undefined
					: [
							{
								icon: LogOut,
								label: 'Sign out',
								destructive: true,
								onSelect: () => (revoking = { token: session.token, device }),
							},
						]}
				actionsLabel={`${device} actions`}
			/>
		{:else}
			<SettingsGroupCell tone="muted">
				There are no active sessions.
			</SettingsGroupCell>
		{/each}
		<SettingsGroupCell>
			<Chip
				variant="destructive-secondary"
				size="compact"
				disabledReason={otherCount === 0
					? 'No other devices are signed in'
					: undefined}
				onclick={() => (signOutOthersOpen = true)}
			>
				Sign out other devices
			</Chip>
		</SettingsGroupCell>
	{/if}
</SettingsSection>

<ChipModalConfirm
	bind:open={() => revoking !== null, closeRevoke}
	onsubmit={revokeSession}
	title="Sign out device"
	text={[
		{ text: revoking?.device ?? 'This device', bold: true },
		' is signed out immediately.',
	]}
	pending={revoke.isPending}
>
	{#snippet confirm()}
		<Chip type="submit" variant="destructive" loading={revoke.isPending}>
			Sign out
		</Chip>
	{/snippet}
</ChipModalConfirm>

<ChipModalConfirm
	bind:open={signOutOthersOpen}
	onsubmit={signOutOtherDevices}
	title="Sign out other devices"
	text="Every other device is signed out. This device stays signed in."
	pending={revokeOthers.isPending}
>
	{#snippet confirm()}
		<Chip type="submit" variant="destructive" loading={revokeOthers.isPending}>
			Sign out others
		</Chip>
	{/snippet}
</ChipModalConfirm>
