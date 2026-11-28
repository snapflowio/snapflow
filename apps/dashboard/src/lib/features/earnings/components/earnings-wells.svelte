<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Wallet from '@lucide/svelte/icons/wallet';
import type { HostEscrowBalance, PaymentWallet } from '@snapflow/api-client';
import Well from '#lib/components/detail/well.svelte';
import InfoTooltip from '#lib/components/page/info-tooltip.svelte';
import { EMPTY_CELL_PLACEHOLDER } from '#lib/components/resource/table/resource-table.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Money from '#lib/components/ui/money.svelte';
import StatusDot from '#lib/components/ui/status/status-dot.svelte';
import StatusRing from '#lib/components/ui/status/status-ring.svelte';
import Tooltip from '#lib/components/ui/tooltip/tooltip.svelte';
import { WELL_FOOTER_LINK_CLASS } from '#lib/features/billing/lib/well-footer-link.ts';
import {
	automaticPayoutInfo,
	belowMinimumLabel,
	payoutMinimumInfo,
	shortDate,
} from '#lib/features/earnings/lib/earnings-copy.ts';
import {
	EARNINGS_STATUS,
	hasMicroUsd,
	type NextPayout,
	walletReadiness,
} from '#lib/features/earnings/lib/earnings-status.ts';
import { shortAddress } from '#lib/features/wallet/lib/payment-wallet.ts';

interface EarningsWellsProps {
	balance: HostEscrowBalance | undefined;
	next: NextPayout | null;
	wallet: PaymentWallet | undefined;
	manageReason?: string;
	onChange: () => void;
}

let { balance, next, wallet, manageReason, onChange }: EarningsWellsProps =
	$props();

const readiness = $derived(walletReadiness(wallet?.sanctionsStatus));
const breakdown = $derived(
	next
		? [
				{ label: 'Amount', microUsd: next.grossMicroUsd },
				{ label: 'Network fee', microUsd: next.feeMicroUsd },
			]
		: []
);
</script>

{#snippet pendingFooter()}
	{#if balance}
		<p class="flex flex-wrap items-center gap-x-1.5">
			{#if hasMicroUsd(balance.frozenMicroUsd)}
				<Tooltip content={EARNINGS_STATUS.held.description}>
					{#snippet child({ props })}
						<span {...props} class="inline-flex items-center gap-1.5">
							<StatusRing
								shape={EARNINGS_STATUS.held.shape}
								tone={EARNINGS_STATUS.held.tone}
								class="size-3.5"
							/>
							<Money microUsd={balance.frozenMicroUsd} />
							held ·
						</span>
					{/snippet}
				</Tooltip>
			{/if}
			<span>
				Paid out to date <Money microUsd={balance.withdrawnMicroUsd} />
			</span>
		</p>
	{/if}
{/snippet}

{#snippet nextFooter()}
	{#if next}
		<dl class="grid w-fit grid-cols-[auto_auto] gap-x-4">
			{#each breakdown as row (row.label)}
				<dt>{row.label}</dt>
				<dd class="text-end tabular-nums">
					<Money microUsd={row.microUsd} precise />
				</dd>
			{/each}
		</dl>
	{:else if balance}
		<p>{belowMinimumLabel(balance.payoutMinimumMicroUsd)}</p>
	{/if}
{/snippet}

{#snippet walletAction()}
	{#if !wallet}
		<Chip variant="primary" disabledReason={manageReason} onclick={onChange}>
			Set payout wallet
		</Chip>
	{/if}
{/snippet}

{#snippet walletFooter()}
	<p class="flex items-center gap-x-1.5">
		<StatusDot label={readiness.label} tone={readiness.tone} />
		{#if readiness.description}
			<InfoTooltip content={readiness.description} />
		{/if}
	</p>
	{#if wallet}
		<Chip
			variant="ghost"
			size="compact"
			leftIcon={Wallet}
			class={WELL_FOOTER_LINK_CLASS}
			disabledReason={manageReason}
			onclick={onChange}
		>
			Change wallet
		</Chip>
	{/if}
{/snippet}

<div class="@container/wells">
	<div
		class="grid gap-8 @2xl/wells:grid-cols-2 @4xl/wells:grid-cols-3 @2xl/wells:[&>:last-child]:col-span-2 @4xl/wells:[&>:last-child]:col-span-1"
	>
		<Well
			title="Not paid out yet"
			info={balance
				? automaticPayoutInfo(balance.payoutMinimumMicroUsd)
				: undefined}
			loading={!balance}
			footer={pendingFooter}
		>
			{#if balance}
				<Money class="heading-s" microUsd={balance.pendingMicroUsd} />
			{/if}
		</Well>
		<Well
			title="Next payout"
			info={balance && !next
				? payoutMinimumInfo(balance.payoutMinimumMicroUsd)
				: undefined}
			loading={!balance}
			footer={nextFooter}
		>
			{#if next}
				<span class="inline-flex items-baseline gap-x-3">
					<Money class="heading-s" microUsd={next.netMicroUsd} />
					<span class="text-(--text-muted) text-sm">{shortDate(next.at)}</span>
				</span>
			{:else}
				<span class="heading-s text-(--text-disabled)"
					>{EMPTY_CELL_PLACEHOLDER}</span
				>
			{/if}
		</Well>
		<Well
			title="Payout wallet"
			actions={wallet ? undefined : walletAction}
			footer={walletFooter}
		>
			{#if wallet}
				<span class="heading-s whitespace-nowrap font-mono"
					>{shortAddress(wallet.address)}</span
				>
			{:else}
				<span class="heading-s text-(--text-disabled)"
					>{EMPTY_CELL_PLACEHOLDER}</span
				>
			{/if}
		</Well>
	</div>
</div>
