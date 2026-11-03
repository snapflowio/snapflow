<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import FeedbackState from '#lib/components/feedback-state.svelte';
import PageHeaderBar from '#lib/components/page/page-header-bar.svelte';
import ListingDetailSections from '#lib/features/listings/components/listing-detail-sections.svelte';
import ListingTile from '#lib/features/listings/components/listing-tile.svelte';
import { formatListingSpecs } from '#lib/features/listings/lib/listing-format.ts';
import { ListingDetail } from '#lib/features/listings/state/listing-detail.svelte.ts';
import { formatHourlyPrice } from '#lib/utils/usd.ts';

let { machineId }: { machineId: string } = $props();

const detail = new ListingDetail(() => machineId);
const listing = $derived(detail.listing);
</script>

<svelte:head>
	<title>{listing?.name ?? 'Listing'} · Snapflow</title>
</svelte:head>

<div class="flex h-full flex-col bg-bg">
	<PageHeaderBar back={detail.back} actions={detail.actions} />
	<div class="min-h-0 flex-1 overflow-y-auto px-6 scrollbar-gutter-both">
		<div class="mx-auto flex max-w-(--column-width) flex-col gap-7 pb-3">
			{#if listing}
				<div class="flex flex-col gap-3">
					<ListingTile gpuCount={listing.gpuCount} />
					<div class="flex flex-col gap-1">
						<h1 class="text-(--text-body) text-lg">{listing.name}</h1>
						<p class="text-(--text-muted) text-md">
							{`${formatListingSpecs(listing)} · ${formatHourlyPrice(listing.hourlyPriceMicroUsd)}`}
						</p>
					</div>
				</div>
				<ListingDetailSections {listing} />
			{:else if detail.query.isError}
				<FeedbackState
					variant="inline"
					tone="error"
					retrying={detail.query.isFetching}
					onRetry={() => void detail.query.refetch()}
				>
					Listing could not be loaded
				</FeedbackState>
			{:else}
				<FeedbackState variant="inline">Loading listing...</FeedbackState>
			{/if}
		</div>
	</div>
</div>
