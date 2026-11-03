<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->
<script lang="ts" module>
import type { SandboxQuote } from '@snapflow/api-client';
import type { CreateQueryResult } from '@tanstack/svelte-query';

export type SandboxQuoteView = Pick<
	CreateQueryResult<SandboxQuote>,
	'data' | 'isError' | 'isPending'
>;
</script>

<script lang="ts">
import { PlacementKind } from '@snapflow/api-client';
import ChipModalReviewRow from '#lib/components/ui/chip-modal/chip-modal-review-row.svelte';
import ChipModalReviewSection from '#lib/components/ui/chip-modal/chip-modal-review-section.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import { BILLING_RESTRICTION_NOTICES } from '#lib/features/billing/lib/billing-restriction.ts';
import { MACHINE_UNAVAILABLE_REASON_LABELS } from '#lib/features/listings/lib/listing-format.ts';
import { formatCount } from '#lib/utils/format.ts';
import {
	formatHourlyPrice,
	formatMicroUsd,
	platformFeeLabel,
} from '#lib/utils/usd.ts';

interface SandboxQuoteSummaryProps {
	quote: SandboxQuoteView;
}

let { quote }: SandboxQuoteSummaryProps = $props();
</script>

{#if quote.isError}
	<Notice tone="warning">
		{#snippet title()}
			A price quote is not available right now
		{/snippet}
		{#snippet description()}
			Review the source, resources and placement before creating.
		{/snippet}
	</Notice>
{:else if quote.isPending || !quote.data}
	<Notice>
		{#snippet title()}
			Checking current prices...
		{/snippet}
		{#snippet description()}
			The quote reflects the machines that can take this sandbox now.
		{/snippet}
	</Notice>
{:else if quote.data.billingRestriction}
	{const notice = $derived(
		BILLING_RESTRICTION_NOTICES[quote.data.billingRestriction]
	)}
	<Notice tone="warning">
		{#snippet title()}
			{notice.title}
		{/snippet}
		{#snippet description()}
			{notice.description}
		{/snippet}
	</Notice>
{:else if !quote.data.available}
	{const unavailableReason = $derived(quote.data.unavailableReason)}
	<Notice tone="warning">
		{#snippet title()}
			No machine can take this sandbox right now
		{/snippet}
		{#snippet description()}
			{unavailableReason
				? `The machine is ${MACHINE_UNAVAILABLE_REASON_LABELS[unavailableReason].toLowerCase()}. Change the placement or try again later.`
				: 'Widen the placement constraints or try again later.'}
		{/snippet}
	</Notice>
{:else}
	{const data = $derived(quote.data)}
	<ChipModalReviewSection title="Price">
		<ChipModalReviewRow
			label="Running"
			value={formatHourlyPrice(data.hourlyPriceMicroUsd)}
		/>
		<ChipModalReviewRow
			label="Stopped"
			value={formatHourlyPrice(data.stoppedHourlyPriceMicroUsd)}
		/>
		<ChipModalReviewRow
			label="Daily · monthly"
			value={`${formatMicroUsd(data.dailyPriceMicroUsd)} · ${formatMicroUsd(data.monthlyPriceMicroUsd)}`}
		/>
		<ChipModalReviewRow
			label={platformFeeLabel(data.markupBasisPoints)}
			value={`${formatHourlyPrice(data.markupHourlyMicroUsd)} of ${formatHourlyPrice(data.hourlyPriceMicroUsd)}`}
		/>
		<ChipModalReviewRow
			label="Required balance"
			value={formatMicroUsd(data.minimumFundingMicroUsd)}
		/>
		<ChipModalReviewRow
			label="Price locked for"
			value={`${data.priceLockDays} days`}
		/>
		{#if data.placementKind === PlacementKind.Flexible}
			<ChipModalReviewRow
				label="Eligible machines"
				value={formatCount(data.eligibleMachineCount)}
			/>
		{/if}
	</ChipModalReviewSection>
{/if}
