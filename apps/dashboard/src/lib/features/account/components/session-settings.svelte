<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
interface SessionRow {
	token: string;
	device: string;
}
</script>

<script lang="ts">
import Ban from '@lucide/svelte/icons/ban';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	revokeSessionMutationOptions,
	sessionsQueryOptions,
} from '#lib/api/account/sessions.ts';
import FeedbackState from '#lib/components/feedback-state.svelte';
import SettingsResourceRow from '#lib/components/settings/settings-resource-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import { formatDateTime } from '#lib/utils/format.ts';
import AccountRowMenu from './account-row-menu.svelte';

const auth = getAuth();
const sessionsQuery = createQuery(() => sessionsQueryOptions());
const revoke = createMutation(() => revokeSessionMutationOptions());
const sessions = $derived(sessionsQuery.data ?? []);
const currentToken = $derived(auth.session?.session.token);
let revoking = $state.raw<SessionRow | null>(null);

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
</script>

<SettingsSection title="Sessions">
	{#if sessionsQuery.isPending}
		<FeedbackState variant="inline">Loading sessions...</FeedbackState>
	{:else if sessionsQuery.isError}
		<FeedbackState
			variant="inline"
			tone="error"
			message="Failed to load sessions"
			retrying={sessionsQuery.isFetching}
			onRetry={() => void sessionsQuery.refetch()}
		/>
	{:else if sessions.length === 0}
		<FeedbackState variant="inline">No active sessions</FeedbackState>
	{:else}
		<div class="flex flex-col gap-y-0.5">
			{#each sessions as session (session.token)}
				{const isCurrent = $derived(session.token === currentToken)}
				{const device = $derived(session.userAgent || 'Unknown device')}
				{#snippet currentBadge()}
					<span class="whitespace-nowrap text-(--text-muted) text-caption">
						This device
					</span>
				{/snippet}
				{#snippet menu()}
					<AccountRowMenu
						label="Session actions"
						actions={[
							{
								icon: Ban,
								label: 'Revoke',
								destructive: true,
								onSelect: () => (revoking = { token: session.token, device }),
							},
						]}
					/>
				{/snippet}
				<SettingsResourceRow
					title={device}
					description={`${session.ipAddress || 'Unknown IP'} · Signed in ${formatDateTime(session.createdAt)}`}
					badge={isCurrent ? currentBadge : undefined}
					trailing={isCurrent ? undefined : menu}
				/>
			{/each}
		</div>
	{/if}
</SettingsSection>

<ChipModalConfirm
	bind:open={() => revoking !== null, closeRevoke}
	onsubmit={revokeSession}
	title="Revoke session"
	text={[
		'Revoking ',
		{ text: revoking?.device ?? 'this session', bold: true },
		' ',
		{ text: 'signs that device out immediately.', error: true },
	]}
	pending={revoke.isPending}
>
	{#snippet confirm()}
		<ChipModalAction
			type="submit"
			variant="destructive"
			disabled={revoke.isPending}
		>
			{revoke.isPending ? 'Revoking...' : 'Revoke'}
		</ChipModalAction>
	{/snippet}
</ChipModalConfirm>
