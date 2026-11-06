<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
function nonZero(microUsd: string): boolean {
	return BigInt(microUsd) !== 0n;
}
</script>

<script lang="ts">
import { createQuery } from '@tanstack/svelte-query';
import { billingStatementQueryOptions } from '#lib/api/billing/usage.ts';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import QueryFeedbackState from '#lib/components/query-feedback-state.svelte';
import { formatStatementPeriod } from '#lib/features/billing/lib/format.ts';
import { formatUsd } from '#lib/utils/usd.ts';
import DetailsField from './details-field.svelte';

interface StatementDetailsProps {
	month: string;
}

let { month }: StatementDetailsProps = $props();

const statement = createQuery(() => billingStatementQueryOptions(month));
</script>

{#snippet row(
	rowLabel: string,
	rowValue: string,
	rowDetail?: string
)}
	{#snippet detail()}
		{rowDetail}
	{/snippet}
	<KeyValueRow detail={rowDetail ? detail : undefined}>
		{#snippet label()}
			{rowLabel}
		{/snippet}
		{#snippet value()}
			{rowValue}
		{/snippet}
	</KeyValueRow>
{/snippet}

{#snippet heading(
	text: string
)}
	<h3 class="mt-1.5 pl-0.5 text-(--text-tertiary) text-caption">{text}</h3>
{/snippet}

{#if statement.isSuccess}
	{const { customer, host } = $derived(statement.data)}
	{const hosted = $derived(
		[host.earningsMicroUsd, host.claimedMicroUsd, host.forfeitedMicroUsd].some(
			nonZero
		)
	)}
	<div class="flex flex-col gap-2.5 pt-1">
		<div class="grid grid-cols-2 gap-x-3 pb-0.5">
			<DetailsField
				label="Period (UTC)"
				value={formatStatementPeriod(
					statement.data.periodStart,
					statement.data.periodEnd
				)}
			/>
			<DetailsField
				label="Status"
				value={statement.data.open ? 'In progress' : 'Closed'}
			/>
		</div>
		{@render heading('Credit')}
		<KeyValueList>
			{@render row(
				'Opening balance',
				formatUsd(customer.openingCreditMicroUsd)
			)}
			{#if nonZero(customer.depositsMicroUsd)}
				{@render row('Deposits', formatUsd(customer.depositsMicroUsd))}
			{/if}
			{#if nonZero(customer.withdrawalsMicroUsd)}
				{@render row('Withdrawals', formatUsd(customer.withdrawalsMicroUsd))}
			{/if}
			{#if nonZero(customer.adminGrantsMicroUsd)}
				{@render row('Granted credit', formatUsd(customer.adminGrantsMicroUsd))}
			{/if}
			{@render row('Usage', formatUsd(customer.usageMicroUsd))}
			{#if nonZero(customer.privatePoolMicroUsd)}
				{@render row(
					'Private pool',
					formatUsd(customer.privatePoolMicroUsd),
					'Monthly fees of machines kept private'
				)}
			{/if}
			{#if nonZero(customer.forfeitureCreditsMicroUsd)}
				{@render row(
					'Returned charges',
					formatUsd(customer.forfeitureCreditsMicroUsd)
				)}
			{/if}
			{@render row(
				'Closing balance',
				formatUsd(customer.closingCreditMicroUsd)
			)}
		</KeyValueList>
		{#if nonZero(customer.claimsPaidMicroUsd)}
			{@render heading('Escrow')}
			<KeyValueList>
				{@render row(
					'Claimed from your escrow',
					formatUsd(customer.claimsPaidMicroUsd),
					'Settles usage already charged above'
				)}
			</KeyValueList>
		{/if}
		{#if customer.usageBySandbox.length > 0}
			{@render heading('Usage by sandbox')}
			<KeyValueList>
				{#each customer.usageBySandbox as usage (usage.sandboxId)}
					{@render row(
						usage.sandboxName ?? usage.sandboxId,
						formatUsd(usage.amountMicroUsd)
					)}
				{/each}
			</KeyValueList>
		{/if}
		{#if hosted}
			{@render heading('Hosting')}
			<KeyValueList>
				{@render row(
					'Earned',
					formatUsd(host.earningsMicroUsd),
					'Paid to your payout wallet as claims settle'
				)}
				{#if nonZero(host.claimedMicroUsd)}
					{@render row(
						'Claimed',
						formatUsd(host.claimedMicroUsd),
						'Paid to your payout wallet'
					)}
				{/if}
				{#if nonZero(host.forfeitedMicroUsd)}
					{@render row('Forfeited', formatUsd(host.forfeitedMicroUsd))}
				{/if}
			</KeyValueList>
		{/if}
		{#if statement.data.open}
			<p class="px-0.5 text-(--text-tertiary) text-xs">
				Amounts change until the month ends.
			</p>
		{/if}
	</div>
{:else}
	<QueryFeedbackState
		query={statement}
		loadingMessage="Loading the statement..."
		errorMessage="The statement could not be loaded."
	/>
{/if}
