<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { WalletTransactionStatus } from '@snapflow/api-client';
import type {
	StatusRingShape,
	StatusRingTone,
} from '#lib/components/ui/status/status-ring.svelte';

const RECENT_LIMIT = 5;

const TRANSACTION_STATUS = {
	[WalletTransactionStatus.Queued]: { shape: 'dashed', tone: 'neutral' },
	[WalletTransactionStatus.Sent]: { shape: 'half', tone: 'neutral' },
	[WalletTransactionStatus.Succeeded]: { shape: 'check', tone: 'success' },
	[WalletTransactionStatus.Failed]: { shape: 'cross', tone: 'error' },
} as const satisfies Record<
	WalletTransactionStatus,
	{ shape: StatusRingShape; tone: StatusRingTone }
>;
</script>

<script lang="ts">
import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
import type { PublicSettlementConfig } from '@snapflow/api-client';
import { createQuery } from '@tanstack/svelte-query';
import { walletTransactionsQueryOptions } from '#lib/api/settlement/user-wallet-queries.ts';
import PageSection from '#lib/components/detail/page-section.svelte';
import EmptyState from '#lib/components/empty-state.svelte';
import FeedbackState from '#lib/components/feedback-state.svelte';
import { EMPTY_CELL_PLACEHOLDER } from '#lib/components/resource/table/resource-table.ts';
import AddressDisplay from '#lib/components/ui/address/address-display.svelte';
import Skeleton from '#lib/components/ui/skeleton/skeleton.svelte';
import StatusLabel from '#lib/components/ui/status/status-label.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import { WALLET_TRANSACTION_BADGES } from '#lib/features/wallet/lib/wallet-status.ts';
import {
	walletTransactionFee,
	walletTransactionLabel,
} from '#lib/features/wallet/lib/wallet-transaction.ts';

interface WalletActivitySectionProps {
	settlement: PublicSettlementConfig;
}

let { settlement }: WalletActivitySectionProps = $props();

const transactions = createQuery(() => walletTransactionsQueryOptions());
let expanded = $state(false);
const all = $derived(transactions.data ?? []);
const shown = $derived(expanded ? all : all.slice(0, RECENT_LIMIT));
</script>

<PageSection title="Transactions">
	{#if transactions.isSuccess}
		{#if shown.length > 0}
			<div
				class="flex flex-col overflow-hidden rounded-2xl border border-border"
			>
				<ul
					class="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
				>
					{#each shown as transaction (transaction.id)}
						{const status = $derived(TRANSACTION_STATUS[transaction.status])}
						<li
							class="col-span-full grid grid-cols-subgrid items-center gap-x-4 border-border border-t px-6 py-4 text-sm first:border-t-0"
						>
							<StatusLabel
								class="min-w-0"
								label={walletTransactionLabel(transaction, settlement)}
								shape={status.shape}
								tone={status.tone}
								live={transaction.status === WalletTransactionStatus.Sent}
								description={transaction.error ??
									WALLET_TRANSACTION_BADGES[transaction.status].label}
							/>
							<span
								class="text-right text-(--text-muted) text-xs tabular-nums max-sm:hidden"
							>
								{walletTransactionFee(transaction)}
							</span>
							<Timestamp
								class="whitespace-nowrap text-right text-(--text-subtle)"
								value={transaction.createdAt}
							/>
							<span class="flex justify-end max-sm:hidden">
								{#if transaction.transactionHash}
									<AddressDisplay
										value={transaction.transactionHash}
										kind="tx"
									/>
								{:else}
									<span class="text-(--text-subtle)"
										>{EMPTY_CELL_PLACEHOLDER}</span
									>
								{/if}
							</span>
						</li>
					{/each}
				</ul>
				{#if all.length > RECENT_LIMIT}
					<button
						type="button"
						class="flex h-11 cursor-pointer items-center justify-center border-border border-t text-(--text-muted) text-sm outline-none transition-colors hover-hover:text-(--text-primary) focus-visible:focus-ring-inset"
						onclick={() => (expanded = !expanded)}
					>
						{expanded ? 'Show less' : `View all ${all.length}`}
					</button>
				{/if}
			</div>
		{:else}
			<EmptyState
				icon={ArrowLeftRight}
				title="No wallet activity yet"
				description="Transfers in and out of this wallet show up here."
			/>
		{/if}
	{:else if transactions.isError}
		<FeedbackState
			variant="inline"
			tone="error"
			resource="wallet activity"
			error={transactions.error}
			retrying={transactions.isFetching}
			onRetry={() => void transactions.refetch()}
		/>
	{:else}
		<Skeleton class="h-9" repeat={RECENT_LIMIT} fade />
	{/if}
</PageSection>
