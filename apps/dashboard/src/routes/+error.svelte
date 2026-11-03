<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import NotFoundPage from '#lib/components/app/not-found-page.svelte';
import RootErrorPage from '#lib/components/app/root-error-page.svelte';
import { refreshAll } from '$app/navigation';
import { page } from '$app/state';
import type { ErrorProps } from './$types';

const NOT_FOUND_STATUS = 404;

let { error: routeError }: ErrorProps = $props();

const notFound = $derived(page.status === NOT_FOUND_STATUS);
</script>

<svelte:head>
	<title>
		{notFound ? 'Page not found' : 'Something went wrong'}
		· Snapflow
	</title>
</svelte:head>

{#if notFound}
	<NotFoundPage />
{:else}
	<RootErrorPage
		details={routeError.details}
		message={routeError.message}
		onRetry={() => void refreshAll()}
	/>
{/if}
