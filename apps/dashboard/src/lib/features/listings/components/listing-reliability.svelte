<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import DetailSection from '#lib/components/detail/detail-section.svelte';
import MetricCell from '#lib/components/detail/metric-cell.svelte';
import MetricGroup, {
	metricColumns,
} from '#lib/components/detail/metric-group.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import PageColumn from '#lib/components/page/page-column.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import {
	MACHINE_TIER_LABELS,
	MACHINE_UNAVAILABLE_REASON_LABELS,
	tierBadgeVariant,
} from '#lib/features/listings/lib/listing-format.ts';
import { getListingDetail } from '#lib/features/listings/state/listing-detail.svelte.ts';
import { formatBasisPointsPercent } from '#lib/utils/format.ts';

const detail = getListingDetail();
const listing = $derived(detail.loaded);
const benchmark = $derived(listing.latestBenchmark);
const availability = $derived.by(() => {
	if (listing.available) return 'Available';
	return listing.unavailableReason
		? MACHINE_UNAVAILABLE_REASON_LABELS[listing.unavailableReason]
		: 'Unavailable';
});
const record = $derived([
	{
		title: 'Reliability',
		value: formatBasisPointsPercent(listing.reliabilityBasisPoints),
		caption: 'Completed rentals',
	},
	{
		title: 'Uptime',
		value: formatBasisPointsPercent(listing.uptimeBasisPoints),
		caption: 'Time online',
	},
]);
</script>

<PageColumn class="gap-y-12">
	<DetailSection title="Track record" separated={false}>
		<MetricGroup label="Track record" columns={metricColumns(record.length)}>
			{#each record as item (item.title)}
				<MetricCell
					size="md"
					title={item.title}
					value={item.value}
					caption={item.caption}
				/>
			{/each}
		</MetricGroup>
	</DetailSection>
	<DetailSection title="Standing">
		<KeyValueList label="Standing">
			<KeyValueRow label="Tier" info="Earned by track record">
				<Badge size="pill" variant={tierBadgeVariant(listing.tier)}>
					{MACHINE_TIER_LABELS[listing.tier]}
				</Badge>
			</KeyValueRow>
			<KeyValueRow label="Availability" value={availability} />
			<KeyValueRow label="Latest benchmark">
				{#if benchmark}
					<ResourceStateBadge state={benchmark.state} />
				{:else}
					<span class="text-(--text-muted)">Not measured</span>
				{/if}
			</KeyValueRow>
			{#if benchmark?.completedAt}
				<KeyValueRow label="Benchmarked">
					<Timestamp value={benchmark.completedAt} />
				</KeyValueRow>
			{/if}
		</KeyValueList>
	</DetailSection>
</PageColumn>
