<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import StatisticCard from '#lib/components/detail/statistic-card.svelte';
import { EMPTY_CELL_PLACEHOLDER } from '#lib/components/resource/table/resource-table.ts';
import Money from '#lib/components/ui/money.svelte';
import type { PriceSplit } from '#lib/features/host-pricing/lib/price-split.ts';
import { formatBasisPointsPercent } from '#lib/utils/format.ts';

interface PriceSplitStatsProps {
	split: PriceSplit | null;
	markupBasisPoints: number | null;
}

let { split, markupBasisPoints }: PriceSplitStatsProps = $props();

const feeInfo = $derived(
	markupBasisPoints === null
		? undefined
		: `Includes the Snapflow fee: ${formatBasisPointsPercent(markupBasisPoints)} on top of your rates.`
);
</script>

{#snippet hourly(microUsd: string | undefined)}
	{#if microUsd === undefined}
		<span class="text-(--text-disabled)">{EMPTY_CELL_PLACEHOLDER}</span>
	{:else}
		<Money {microUsd} precise />
	{/if}
{/snippet}

<div class="flex flex-col gap-6 sm:flex-row">
	<StatisticCard size="lg" label="You earn / hour">
		{@render hourly(split?.youGetMicroUsd)}
	</StatisticCard>
	<StatisticCard size="lg" label="Renter pays / hour" info={feeInfo}>
		{@render hourly(split?.renterPaysMicroUsd)}
	</StatisticCard>
</div>
