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

const OWN_MACHINE_LABEL = 'Free on your own machine';
const WHOLE_MACHINE_LABEL = 'Rent the whole machine';
const WHOLE_MACHINE_NOTE =
	'Takes the machine’s full shape and runs only while no other sandbox does; nothing else is placed there meanwhile.';
</script>

<script lang="ts">
import { PlacementKind } from '@snapflow/api-client';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import ChipModalReviewSection from '#lib/components/ui/chip-modal/chip-modal-review-section.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import Switch from '#lib/components/ui/switch.svelte';
import { MACHINE_UNAVAILABLE_REASON_LABELS } from '#lib/features/listings/lib/listing-format.ts';
import SandboxAttentionNotice from '#lib/features/sandboxes/components/sandbox-attention-notice.svelte';
import { billingRestrictionAttention } from '#lib/features/sandboxes/lib/sandbox-attention.ts';
import { formatCount } from '#lib/utils/format.ts';
import {
	formatHourlyPrice,
	formatMicroUsd,
	platformFeeLabel,
} from '#lib/utils/usd.ts';

interface SandboxQuoteSummaryProps {
	quote: SandboxQuoteView;
	wholeMachine: boolean;
	onWholeMachineChange: (wholeMachine: boolean) => void;
}

let { quote, wholeMachine, onWholeMachineChange }: SandboxQuoteSummaryProps =
	$props();
</script>

{#if quote.isError}
	<Notice tone="warning">
		{#snippet title()}
			A price quote is not available right now
		{/snippet}
		{#snippet info()}
			Review the source, resources and placement before creating.
		{/snippet}
	</Notice>
{:else if quote.isPending || !quote.data}
	<Notice>
		{#snippet title()}
			Checking current prices...
		{/snippet}
		{#snippet info()}
			The quote reflects the machines that can take this sandbox now.
		{/snippet}
	</Notice>
{:else if quote.data.billingRestriction}
	<SandboxAttentionNotice
		attention={billingRestrictionAttention(quote.data.billingRestriction)}
	/>
{:else if !quote.data.available}
	{const unavailableReason = $derived(quote.data.unavailableReason)}
	<Notice tone="warning">
		{#snippet title()}
			No machine can take this sandbox right now
		{/snippet}
		{#snippet info()}
			{unavailableReason
				? `The machine is ${MACHINE_UNAVAILABLE_REASON_LABELS[unavailableReason].toLowerCase()}. Change the placement or try again later.`
				: 'Widen the placement constraints or try again later.'}
		{/snippet}
	</Notice>
{:else if quote.data.priceCardId === undefined}
	<ChipModalReviewSection title="Price">
		<KeyValueRow align="end" label="Compute" value={OWN_MACHINE_LABEL} />
	</ChipModalReviewSection>
{:else}
	{const data = $derived(quote.data)}
	<div class="flex flex-col gap-y-3">
		<ChipModalReviewSection title="Price">
			<KeyValueRow
				align="end"
				label="Running"
				value={formatHourlyPrice(data.hourlyPriceMicroUsd)}
			/>
			<KeyValueRow
				align="end"
				label={platformFeeLabel(data.markupBasisPoints)}
				value={`${formatHourlyPrice(data.hostHourlyMicroUsd)} host + ${formatHourlyPrice(data.markupHourlyMicroUsd)} fee`}
			/>
			<KeyValueRow
				align="end"
				label="Stopped on the host"
				value={formatHourlyPrice(data.stoppedHourlyPriceMicroUsd)}
			/>
			{#if data.wholeMachineHourlyPriceMicroUsd}
				{const wholeMachinePrice = $derived(
					formatHourlyPrice(data.wholeMachineHourlyPriceMicroUsd)
				)}
				{#snippet wholeMachineChoice()}
					<span class="inline-flex items-center gap-2">
						{wholeMachinePrice}
						<Switch
							aria-label={WHOLE_MACHINE_LABEL}
							checked={wholeMachine}
							onCheckedChange={onWholeMachineChange}
						/>
					</span>
				{/snippet}
				<KeyValueRow
					align="end"
					label="Whole machine, when empty"
					value={wholeMachineChoice}
				/>
			{/if}
			<KeyValueRow
				align="end"
				label="Daily · monthly"
				value={`${formatMicroUsd(data.dailyPriceMicroUsd)} · ${formatMicroUsd(data.monthlyPriceMicroUsd)}`}
			/>
			<KeyValueRow
				align="end"
				label="Balance needed to start"
				value={formatMicroUsd(data.minimumFundingMicroUsd)}
			/>
			<KeyValueRow
				align="end"
				label="Price increases apply"
				value={`At the next start or after ${data.priceLockDays} days`}
			/>
			{#if data.placementKind === PlacementKind.Flexible}
				<KeyValueRow
					align="end"
					label="Eligible machines"
					value={formatCount(data.eligibleMachineCount)}
				/>
			{/if}
		</ChipModalReviewSection>
		<p class="text-(--text-muted) text-sm">
			The balance needed covers an hour of everything your organization would
			then run.
		</p>
		{#if data.wholeMachine}
			<p class="text-(--text-muted) text-sm">{WHOLE_MACHINE_NOTE}</p>
		{/if}
	</div>
{/if}
