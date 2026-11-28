<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const RECENT_ACTIVITY_LIMIT = 5;
const RECENT_ACTIVITY_TITLE = 'Recent activity';
</script>

<script lang="ts">
import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
import { SettlementParty } from '@snapflow/api-client';
import { createQuery } from '@tanstack/svelte-query';
import { recentEscrowEventsQueryOptions } from '#lib/api/settlement/escrow.ts';
import EmptyState from '#lib/components/empty-state.svelte';
import FeedbackState from '#lib/components/feedback-state.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Money from '#lib/components/ui/money.svelte';
import Skeleton from '#lib/components/ui/skeleton/skeleton.svelte';
import StatusRing from '#lib/components/ui/status/status-ring.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import {
	CUSTOMER_MONEY_EVENT_KINDS,
	escrowEventLabel,
	escrowEventReverted,
	escrowEventSigned,
	escrowEventSignedMicroUsd,
	escrowEventStatus,
} from '#lib/features/billing/lib/escrow-event.ts';
import { Path } from '#lib/routing/paths.ts';
import { resolve } from '$app/paths';

const party = SettlementParty.Customer;
const events = createQuery(() =>
	recentEscrowEventsQueryOptions({
		limit: RECENT_ACTIVITY_LIMIT,
		role: party,
		kind: [...CUSTOMER_MONEY_EVENT_KINDS],
	})
);
const rows = $derived(events.data?.items ?? []);
</script>

{#snippet viewAll()}
	<Chip size="compact" variant="secondary" href={resolve(Path.BILLING_HISTORY)}>
		View all
	</Chip>
{/snippet}

<SettingsSection title={RECENT_ACTIVITY_TITLE} action={viewAll}>
	{#if events.isSuccess}
		{#if rows.length > 0}
			{#each rows as escrowEvent (escrowEvent.id)}
				{const status = $derived(escrowEventStatus(escrowEvent))}
				{const amount = $derived(escrowEventSignedMicroUsd(escrowEvent, party))}
				<div
					data-settings-row=""
					class="flex min-w-0 items-center gap-3 text-sm"
				>
					<StatusRing shape={status.shape} tone={status.tone} />
					<span class="min-w-0 flex-1 truncate text-(--text-primary)">
						{escrowEventLabel(escrowEvent, party)}
					</span>
					{#if amount !== null}
						<Money
							class="text-(--text-primary)"
							microUsd={amount}
							signed={escrowEventSigned(escrowEvent, party)}
							struck={escrowEventReverted(escrowEvent)}
						/>
					{/if}
					<Timestamp
						class="min-w-24 shrink-0 whitespace-nowrap text-right text-(--text-subtle)"
						value={escrowEvent.blockTimestamp}
					/>
				</div>
			{/each}
		{:else}
			<EmptyState
				icon={ArrowLeftRight}
				title="No transactions yet"
				description="Deposits, withdrawals and automatic payments show up here."
			/>
		{/if}
	{:else if events.isError}
		<FeedbackState
			variant="inline"
			tone="error"
			resource="recent activity"
			error={events.error}
			retrying={events.isFetching}
			onRetry={() => void events.refetch()}
		/>
	{:else}
		<Skeleton class="h-9" repeat={RECENT_ACTIVITY_LIMIT} fade />
	{/if}
</SettingsSection>
