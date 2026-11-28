<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const HERO_TWEEN_MILLISECONDS = 600;
const NOTHING_RUNNING = 'Nothing running';
</script>

<script lang="ts">
import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
import type { EscrowAccount } from '@snapflow/api-client';
import { prefersReducedMotion, Tween } from 'svelte/motion';
import { getPublicConfig } from '#lib/api/public-config.ts';
import Well from '#lib/components/detail/well.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Money from '#lib/components/ui/money.svelte';
import { formatRunway } from '#lib/features/billing/lib/billing-overview.ts';
import {
	availableBreakdown,
	hasMicroUsd,
} from '#lib/features/billing/lib/escrow-balance.ts';
import { formatRemaining } from '#lib/features/billing/lib/escrow-terms.ts';
import { WELL_FOOTER_LINK_CLASS } from '#lib/features/billing/lib/well-footer-link.ts';
import { settlementChain } from '#lib/integrations/wallet/wallet-networks.ts';
import { formatDate } from '#lib/utils/format.ts';
import { formatHourlyPrice, formatUsd } from '#lib/utils/usd.ts';
import AskBillingManager from '../ask-billing-manager.svelte';

interface BalanceWellProps {
	account: EscrowAccount;
	canManage: boolean;
	hasPendingDeposits: boolean;
	onAddFunds: () => void;
	onWithdraw: () => void;
}

let {
	account,
	canManage,
	hasPendingDeposits,
	onAddFunds,
	onWithdraw,
}: BalanceWellProps = $props();

const { chainId } = getPublicConfig().settlement;
const networkName = settlementChain(chainId).name;
const available = Tween.of(() => Number(account.availableMicroUsd), {
	duration: () => (prefersReducedMotion.current ? 0 : HERO_TWEEN_MILLISECONDS),
});

const shown = $derived(BigInt(Math.round(available.current)));
const burn = $derived(BigInt(account.burnMicroUsdPerHour));
const runway = $derived(formatRunway(account.runwaySeconds));
const runwayLine = $derived(
	burn > 0n && runway
		? `≈ ${runway} left at ${formatHourlyPrice(account.burnMicroUsdPerHour)}`
		: NOTHING_RUNNING
);
const fundingAddress = $derived(account.fundingWalletAddress);
const empty = $derived(
	!hasMicroUsd(account.availableMicroUsd) && !hasPendingDeposits
);
const withdrawingLine = $derived.by(() => {
	if (!hasMicroUsd(account.pendingMicroUsd)) return null;
	const amount = formatUsd(account.pendingMicroUsd);
	if (account.blockedAt) return `${amount} withdrawing, paused while frozen`;
	const remaining = account.withdrawalUnlocksInSeconds;
	if (remaining === 0) return `${amount} withdrawing, ready to complete`;
	return remaining === null
		? `${amount} withdrawing`
		: `${amount} withdrawing, unlocks in ${formatRemaining(remaining)}`;
});
const frozenLine = $derived.by(() => {
	if (!hasMicroUsd(account.frozenMicroUsd)) return null;
	const amount = formatUsd(account.frozenMicroUsd);
	return account.blockedUntil
		? `${amount} frozen until ${formatDate(account.blockedUntil)}`
		: `${amount} frozen`;
});
</script>

<Well title="Available balance" info={availableBreakdown(account)}>
	{#snippet actions()}
		{#if canManage}
			<Chip variant="primary" onclick={onAddFunds}>Add funds</Chip>
		{:else}
			<AskBillingManager />
		{/if}
	{/snippet}
	<p class="flex items-baseline gap-x-2">
		<Money class="heading-s" microUsd={shown} />
		<span class="text-(--text-muted) text-sm">USDC</span>
	</p>
	{#snippet footer()}
		{#if withdrawingLine}
			<p class="tabular-nums">{withdrawingLine}</p>
		{/if}
		{#if frozenLine}
			<p class="tabular-nums">{frozenLine}</p>
		{/if}
		{#if empty && fundingAddress}
			<p>{`Send USDC on ${networkName} to your funding wallet`}</p>
		{:else}
			<p class="tabular-nums">{runwayLine}</p>
		{/if}
		{#if canManage}
			<Chip
				variant="ghost"
				size="compact"
				leftIcon={ArrowUpRight}
				class={WELL_FOOTER_LINK_CLASS}
				onclick={onWithdraw}
			>
				Withdraw
			</Chip>
		{/if}
	{/snippet}
</Well>
