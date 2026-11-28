<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const FREE_LABEL = 'Free';
const NONE_YET = 'None yet';
</script>

<script lang="ts">
import { createQuery } from '@tanstack/svelte-query';
import { listingHostQueryOptions } from '#lib/api/host-profile.ts';
import ContextCard from '#lib/components/detail/context-card.svelte';
import StatisticCard from '#lib/components/detail/statistic-card.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import IdentityTile from '#lib/components/ui/avatar/identity-tile.svelte';
import Money from '#lib/components/ui/money.svelte';
import { middleTruncate } from '#lib/components/ui/overflow/middle-truncate.ts';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import {
	MACHINE_CATEGORY_LABELS,
	MACHINE_TIER_LABELS,
} from '#lib/features/listings/lib/listing-format.ts';
import type { ListingDetail } from '#lib/features/listings/state/listing-detail.svelte.ts';
import { locationLabel } from '#lib/features/locations/lib/location-format.ts';
import { formatBasisPointsPercent, formatCount } from '#lib/utils/format.ts';

interface ListingContextPanelProps {
	detail: ListingDetail;
}

let { detail }: ListingContextPanelProps = $props();

const listing = $derived(detail.loaded);
const host = createQuery(() => listingHostQueryOptions(listing.machineId));
const profile = $derived(host.data);
const hostName = $derived(profile?.displayName ?? listing.hostName);
</script>

<div class="flex flex-col gap-2">
	<ContextCard>
		<div class="flex min-w-0 items-center gap-3">
			<IdentityTile name={hostName} size="lg" />
			<div class="flex min-w-0 flex-col">
				<p class="truncate text-(--text-primary) text-base">{hostName}</p>
				{#if profile?.description}
					<p class="line-clamp-2 text-(--text-muted) text-sm">
						{profile.description}
					</p>
				{/if}
			</div>
		</div>
		<div class="flex gap-6">
			<StatisticCard
				label="Reliability"
				value={formatBasisPointsPercent(listing.reliabilityBasisPoints)}
			/>
			<StatisticCard label="Price per hour">
				{#if listing.priceCardId === null}
					{FREE_LABEL}
				{:else}
					<Money microUsd={listing.hourlyPriceMicroUsd} />
				{/if}
			</StatisticCard>
		</div>
	</ContextCard>
	<ContextCard title="Details">
		<KeyValueList framed={false} label="Details">
			<KeyValueRow
				label="ID"
				mono
				copy={listing.machineId}
				copyLabel="Copy machine ID"
			>
				<span
					class="block overflow-hidden whitespace-nowrap"
					{@attach middleTruncate({ text: listing.machineId })}
				></span>
			</KeyValueRow>
			<KeyValueRow label="Location" value={locationLabel(listing.location)} />
			<KeyValueRow
				label="Category"
				value={MACHINE_CATEGORY_LABELS[listing.category]}
			/>
			<KeyValueRow
				label="Uptime"
				value={formatBasisPointsPercent(listing.uptimeBasisPoints)}
			/>
			<KeyValueRow label="Measured">
				<Timestamp value={listing.measuredAt} />
			</KeyValueRow>
		</KeyValueList>
	</ContextCard>
	{#if profile?.stats}
		<ContextCard title="Host record">
			{@const stats = profile.stats}
			<KeyValueList framed={false} label="Host record">
				<KeyValueRow
					label="Listed machines"
					value={formatCount(stats.listedMachines)}
				/>
				<KeyValueRow
					label="Top tier"
					value={stats.topTier ? MACHINE_TIER_LABELS[stats.topTier] : NONE_YET}
				/>
			</KeyValueList>
		</ContextCard>
	{/if}
</div>
