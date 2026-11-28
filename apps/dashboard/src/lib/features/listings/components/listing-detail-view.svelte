<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const CONTEXT_LABEL = 'Machine';
</script>

<script lang="ts">
import type { Snippet } from 'svelte';
import SectionError from '#lib/components/app/section-error.svelte';
import ResourceChromeFallback from '#lib/components/resource/resource-chrome-fallback.svelte';
import ResourceDetailShell from '#lib/components/resource/resource-detail-shell.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import ListingContextPanel from '#lib/features/listings/components/listing-context-panel.svelte';
import {
	MACHINE_TIER_LABELS,
	MACHINE_UNAVAILABLE_REASON_LABELS,
	tierBadgeVariant,
} from '#lib/features/listings/lib/listing-format.ts';
import {
	ListingDetail,
	setListingDetail,
} from '#lib/features/listings/state/listing-detail.svelte.ts';

let { machineId, children }: { machineId: string; children: Snippet } =
	$props();

const detail = setListingDetail(new ListingDetail(() => machineId));
const listing = $derived(detail.listing);
let retrying = $state(false);

async function retry(): Promise<void> {
	retrying = true;
	try {
		await detail.query.refetch();
	} finally {
		retrying = false;
	}
}
</script>

{#snippet contextCards()}
	<ListingContextPanel {detail} />
{/snippet}

<svelte:head>
	<title>{listing?.name ?? 'Machine'} · Marketplace · Snapflow</title>
</svelte:head>

{#if detail.query.isPending}
	<ResourceChromeFallback breadcrumbs={detail.crumbs} tabs={detail.tabs} />
{:else if !listing}
	<SectionError
		title="Couldn't load this machine"
		details={detail.query.error?.message}
		backHref={detail.marketplaceCrumb.href}
		backLabel="Back to marketplace"
		{retrying}
		onRetry={() => void retry()}
	/>
{:else}
	<ResourceDetailShell
		breadcrumbs={detail.crumbs}
		tabs={detail.tabs}
		actions={detail.actions}
		asideTitle={CONTEXT_LABEL}
		aside={contextCards}
	>
		{#snippet status()}
			{#if listing.available}
				<Badge variant={tierBadgeVariant(listing.tier)}>
					{MACHINE_TIER_LABELS[listing.tier]}
				</Badge>
			{:else}
				<Badge variant="warning" dot>
					{listing.unavailableReason
						? MACHINE_UNAVAILABLE_REASON_LABELS[listing.unavailableReason]
						: 'Unavailable'}
				</Badge>
			{/if}
		{/snippet}
		{@render children()}
	</ResourceDetailShell>
{/if}
