<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import * as z from 'zod';

const VIEWS = [
	{ id: 'listings', label: 'Listings' },
	{ id: 'reviews', label: 'Review queue' },
	{ id: 'prices', label: 'Reference prices' },
] as const;

const listingsViewSchema = z.object({
	view: z.enum(['listings', 'reviews', 'prices']).catch('listings'),
});
</script>

<script lang="ts">
import Cpu from '@lucide/svelte/icons/cpu';
import Resource from '#lib/components/resource/resource.svelte';
import ResourceHeader from '#lib/components/resource/resource-header.svelte';
import ListingsView from '#lib/features/admin/components/listings/listings-view.svelte';
import ReferencePricesView from '#lib/features/admin/components/listings/reference-prices-view.svelte';
import ReviewsView from '#lib/features/admin/components/listings/reviews-view.svelte';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { page } from '$app/state';

const params = new SearchParams(listingsViewSchema);
const view = $derived(params.current.view);
const tabs = $derived(
	VIEWS.map((tab) => ({
		label: tab.label,
		href:
			tab.id === 'listings'
				? page.url.pathname
				: `${page.url.pathname}?view=${tab.id}`,
		active: view === tab.id,
	}))
);
</script>

<svelte:head>
	<title>Listings · Snapflow</title>
</svelte:head>

<Resource>
	<ResourceHeader
		icon={Cpu}
		title="Listings"
		{tabs}
		tabsLabel="Listing administration views"
	/>
	{#key view}
		{#if view === 'reviews'}
			<ReviewsView />
		{:else if view === 'prices'}
			<ReferencePricesView />
		{:else}
			<ListingsView />
		{/if}
	{/key}
</Resource>
