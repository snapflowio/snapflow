<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const EMPTY_VALUE = '—';
</script>

<script lang="ts">
import type { CreatePriceCard, PriceFloor } from '@snapflow/api-client';
import ResourceStat from '#lib/components/resource/resource-stat.svelte';
import ResourceStats from '#lib/components/resource/resource-stats.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Meter from '#lib/components/ui/meter.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import {
	BINARY_UNITS_NOTE,
	formatEgressPrice,
	formatEgressPricePerTerabyte,
} from '#lib/features/billing/lib/transfer.ts';
import {
	EGRESS_CEILING_SOURCE_LABELS,
	PRICE_FLOOR_SOURCE_LABELS,
} from '#lib/features/listings/lib/listing-format.ts';
import {
	egressPreview,
	floorPreview,
} from '#lib/features/listings/lib/price-card-rates.ts';
import { formatHourlyPrice } from '#lib/utils/usd.ts';

interface PriceCardPreviewProps {
	floor: PriceFloor;
	rates: CreatePriceCard | null;
}

let { floor, rates }: PriceCardPreviewProps = $props();

const { belowFloor, gaugeMaximum, preview } = $derived(
	floorPreview(rates, floor)
);
const { aboveCeiling, egress } = $derived(egressPreview(rates, floor));
const shape = $derived(floor.referenceShape);
</script>

{#snippet textStat(
	statLabel: string,
	statValue: string,
	statDetail?: string
)}
	<ResourceStat detail={statDetail ? detailText : undefined}>
		{#snippet label()}
			{statLabel}
		{/snippet}
		{#snippet value()}
			{statValue}
		{/snippet}
	</ResourceStat>
	{#snippet detailText()}
		{statDetail}
	{/snippet}
{/snippet}

{#snippet warning(
	noticeTitle: string,
	noticeDescription: string
)}
	<Notice tone="warning">
		{#snippet title()}
			{noticeTitle}
		{/snippet}
		{#snippet description()}
			{noticeDescription}
		{/snippet}
	</Notice>
{/snippet}

<SettingsSection>
	{#snippet title()}
		Reference price
	{/snippet}
	{#snippet description()}
		{`Host price for ${shape.cpu} vCPU, ${shape.memoryGiB} GiB RAM, ${shape.diskGiB} GiB disk${shape.gpu > 0 ? `, ${shape.gpu} GPU` : ''} for one hour, before the platform fee.`}
	{/snippet}
	<div class="flex flex-col gap-4">
		<ResourceStats class="lg:grid-cols-3">
			{@render textStat(
				'This card',
				preview === null ? EMPTY_VALUE : formatHourlyPrice(preview)
			)}
			{@render textStat(
				'Floor',
				formatHourlyPrice(floor.floorMicroUsd),
				`${PRICE_FLOOR_SOURCE_LABELS[floor.source]} median ${formatHourlyPrice(floor.medianMicroUsd)}`
			)}
			{@render textStat(
				'Current card',
				floor.currentReferencePriceMicroUsd === null
					? EMPTY_VALUE
					: formatHourlyPrice(floor.currentReferencePriceMicroUsd),
				`${floor.sampleCount} hosts sampled`
			)}
		</ResourceStats>
		<Meter
			label="Reference price against the market median"
			maximum={gaugeMaximum}
			marker={Number(floor.floorMicroUsd)}
			tone={belowFloor ? 'error' : 'default'}
			value={preview === null ? 0 : Number(preview)}
			valueText={preview === null
				? 'No reference price'
				: `${formatHourlyPrice(preview)} against a floor of ${formatHourlyPrice(floor.floorMicroUsd)}`}
		/>
		{#if belowFloor}
			{@render warning(
				'Below the market floor',
				`The reference price must be at least ${formatHourlyPrice(floor.floorMicroUsd)}. Raise your rates to publish this card.`
			)}
		{/if}
	</div>
</SettingsSection>

<SettingsSection>
	{#snippet title()}
		Egress price
	{/snippet}
	{#snippet description()}
		{`Your net price per GB before the platform fee. ${BINARY_UNITS_NOTE}`}
	{/snippet}
	<div class="flex flex-col gap-4">
		<ResourceStats class="lg:grid-cols-3">
			{@render textStat(
				'This card',
				egress === null ? EMPTY_VALUE : formatEgressPrice(egress),
				egress === null ? undefined : formatEgressPricePerTerabyte(egress)
			)}
			{@render textStat(
				'Ceiling',
				formatEgressPrice(floor.egressCeilingMicroUsdPerGiB),
				EGRESS_CEILING_SOURCE_LABELS[floor.egressCeilingSource]
			)}
			{@render textStat(
				'Verified median',
				floor.egressMedianMicroUsdPerGiB === null
					? EMPTY_VALUE
					: formatEgressPrice(floor.egressMedianMicroUsdPerGiB),
				`${floor.egressSampleCount} hosts sampled`
			)}
		</ResourceStats>
		{#if aboveCeiling}
			{@render warning(
				'Above the egress ceiling',
				`The egress price must be at most ${formatEgressPrice(floor.egressCeilingMicroUsdPerGiB)}. Lower it to publish this card.`
			)}
		{/if}
	</div>
</SettingsSection>
