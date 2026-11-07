<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const RECENT_CLAIMS_LIMIT = 10;
</script>

<script lang="ts">
import HandCoins from '@lucide/svelte/icons/hand-coins';
import {
	EscrowEventKind,
	type PaymentWallet,
	PayoutReadiness,
	SettlementParty,
} from '@snapflow/api-client';
import { createQuery } from '@tanstack/svelte-query';
import { recentEscrowEventsQueryOptions } from '#lib/api/settlement/escrow.ts';
import QueryFeedbackState from '#lib/components/query-feedback-state.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import BillingHeading from '#lib/features/billing/components/billing-heading.svelte';
import {
	escrowEventAmountMicroUsd,
	escrowEventChannelId,
} from '#lib/features/billing/lib/escrow-event.ts';
import { formatBillingDate } from '#lib/features/billing/lib/format.ts';
import {
	PAYOUT_READINESS,
	shortAddress,
} from '#lib/features/billing/lib/payment-wallet.ts';
import { Path } from '#lib/routing/paths.ts';
import { formatUsd } from '#lib/utils/usd.ts';
import { resolve } from '$app/paths';

interface EarningsOverviewProps {
	readiness: PayoutReadiness;
	payoutWallet: PaymentWallet | undefined;
	canManage: boolean;
}

let { readiness, payoutWallet, canManage }: EarningsOverviewProps = $props();

const copy = $derived(PAYOUT_READINESS[readiness]);
const events = createQuery(() =>
	recentEscrowEventsQueryOptions({
		limit: RECENT_CLAIMS_LIMIT,
		role: SettlementParty.Host,
		kind: [EscrowEventKind.Claimed],
	})
);
const claims = $derived(events.data?.items ?? []);
const claimedTotal = $derived(
	claims
		.reduce(
			(total, claim) =>
				total +
				BigInt(escrowEventAmountMicroUsd(claim, SettlementParty.Host) ?? 0),
			0n
		)
		.toString()
);
</script>

{#snippet readinessBadge()}
	<span class="flex shrink-0 items-center gap-2">
		<Badge dot size="sm" variant={copy.badge.variant}>{copy.badge.label}</Badge>
		{#if canManage && readiness !== PayoutReadiness.Ready}
			<Chip variant="border-shadow" href={resolve(Path.EARNINGS_PAYOUTS)}>
				Link payout wallet
			</Chip>
		{/if}
	</span>
{/snippet}

<BillingHeading
	icon={HandCoins}
	title={payoutWallet ? shortAddress(payoutWallet.address) : copy.title}
	detail={copy.description}
	trailing={readinessBadge}
/>

{#snippet claimsAction()}
	<Chip href={resolve(Path.EARNINGS_CLAIMS)}>View all</Chip>
{/snippet}

<SettingsSection title="Recent claims" action={claimsAction}>
	{#if events.isSuccess}
		{#if claims.length > 0}
			<div class="-mx-2 flex flex-col gap-y-0.5">
				{#each claims as claim (claim.id)}
					{const channelId = $derived(escrowEventChannelId(claim))}
					{const amount = $derived(
						escrowEventAmountMicroUsd(claim, SettlementParty.Host)
					)}
					<div class="flex items-center gap-2.5 rounded-lg p-2">
						<span class="w-28 shrink-0 text-(--text-body) text-sm">
							{formatBillingDate(claim.blockTimestamp)}
						</span>
						<span
							class="min-w-0 flex-1 truncate text-(--text-muted) text-caption"
						>
							{channelId ? `Channel ${shortAddress(channelId)}` : 'Claim'}
						</span>
						{#if amount}
							<span
								class="shrink-0 text-(--text-muted) text-caption tabular-nums"
							>
								{formatUsd(amount)}
							</span>
						{/if}
					</div>
				{/each}
				<div class="flex items-center justify-between gap-2.5 p-2">
					<span class="text-(--text-body) text-sm">Total shown</span>
					<span class="text-(--text-muted) text-caption tabular-nums">
						{formatUsd(claimedTotal)}
					</span>
				</div>
			</div>
		{:else}
			<p class="pl-0.5 text-(--text-muted) text-caption">
				Claims appear here as Snapflow settles the vouchers your machines earn.
			</p>
		{/if}
	{:else}
		<QueryFeedbackState
			class="py-4"
			query={events}
			loadingMessage="Loading claims..."
			errorMessage="Claims could not be loaded."
		/>
	{/if}
</SettingsSection>
