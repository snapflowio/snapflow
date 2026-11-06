<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { MachinePriceHint } from '@snapflow/api-client';
import FeedbackState from '#lib/components/feedback-state.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import ResourceStat from '#lib/components/resource/resource-stat.svelte';
import ResourceStats from '#lib/components/resource/resource-stats.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import { pricedResourceRate } from '#lib/features/listings/lib/price-card-rates.ts';
import { formatBasisPointsPercent } from '#lib/utils/format.ts';
import { pluralize } from '#lib/utils/text.ts';
import { formatMicroUsd, formatUsd } from '#lib/utils/usd.ts';

interface PriceHintSectionProps {
	hint: MachinePriceHint;
}

let { hint }: PriceHintSectionProps = $props();
</script>

<SettingsSection title="Similar listings">
	{#snippet description()}
		{hint.ranges.length > 0
			? `Host prices from the 10th to the 90th percentile of ${pluralize(hint.similarListingCount, 'public listing')} in ${hint.priceClass}.`
			: `No other public listing in ${hint.priceClass} yet.`}
	{/snippet}
	<div class="flex flex-col gap-4">
		{#if hint.ranges.length > 0}
			<KeyValueList>
				{#each hint.ranges as range (range.resource)}
					{const rate = $derived(pricedResourceRate(range.resource))}
					<KeyValueRow>
						{#snippet label()}
							{rate.label}
						{/snippet}
						{#snippet value()}
							{`${formatMicroUsd(range.lowMicroUsd)} – ${formatMicroUsd(range.highMicroUsd)}`}
						{/snippet}
						{#snippet detail()}
							{rate.unit}
						{/snippet}
					</KeyValueRow>
				{/each}
			</KeyValueList>
		{/if}
		{#if hint.earnings.length > 0}
			<ResourceStats label="Estimated monthly earnings">
				{#each hint.earnings as estimate (estimate.utilizationBasisPoints)}
					<ResourceStat
						label={`At ${formatBasisPointsPercent(estimate.utilizationBasisPoints)} utilization`}
						value={formatUsd(estimate.monthlyMicroUsd)}
						detail="Per month at the current price card"
					/>
				{/each}
			</ResourceStats>
		{:else}
			<FeedbackState variant="inline">
				Publish a price card to estimate monthly earnings.
			</FeedbackState>
		{/if}
	</div>
</SettingsSection>
