<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import Money from '#lib/components/ui/money.svelte';
import type { PriceSplit } from '#lib/features/host-pricing/lib/price-split.ts';
import { formatBasisPointsPercent } from '#lib/utils/format.ts';

const HOURLY_UNIT = '/h';

interface PriceSplitRowsProps {
	split: PriceSplit;
	markupBasisPoints: number;
	label?: string;
}

let { split, markupBasisPoints, label }: PriceSplitRowsProps = $props();
</script>

{#snippet hourly(microUsd: string, emphasis: boolean)}
	<span class={emphasis ? 'text-(--text-primary)' : undefined}>
		<Money {microUsd} precise unit={HOURLY_UNIT} />
	</span>
{/snippet}

<KeyValueList {label}>
	<KeyValueRow label="Renter pays" align="end">
		{@render hourly(split.renterPaysMicroUsd, false)}
	</KeyValueRow>
	<KeyValueRow
		label="Snapflow fee"
		info={`${formatBasisPointsPercent(markupBasisPoints)} on top of your rates`}
		align="end"
	>
		{@render hourly(split.feeMicroUsd, false)}
	</KeyValueRow>
	<KeyValueRow label="You get" align="end">
		{@render hourly(split.youGetMicroUsd, true)}
	</KeyValueRow>
</KeyValueList>
