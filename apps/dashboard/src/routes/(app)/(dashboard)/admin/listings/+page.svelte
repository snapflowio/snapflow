<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Resource from '#lib/components/resource/resource.svelte';
import ListingsView from '#lib/features/admin/components/listings/listings-view.svelte';
import ReviewsView from '#lib/features/admin/components/listings/reviews-view.svelte';
import { LISTING_VIEWS } from '#lib/features/admin/lib/admin-views.ts';
import { AdminViewParam } from '#lib/features/admin/state/admin-view-param.svelte.ts';

const views = new AdminViewParam(LISTING_VIEWS);
</script>

<svelte:head>
	<title>Listings · Snapflow</title>
</svelte:head>

<Resource>
	{#key views.current}
		{#if views.current === 'reviews'}
			<ReviewsView title="Listings" viewSwitch={views.switch} />
		{:else}
			<ListingsView title="Listings" viewSwitch={views.switch} />
		{/if}
	{/key}
</Resource>
