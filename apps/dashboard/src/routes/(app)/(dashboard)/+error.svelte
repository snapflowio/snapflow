<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ArrowLeft from '@lucide/svelte/icons/arrow-left';
import Compass from '@lucide/svelte/icons/compass';
import House from '@lucide/svelte/icons/house';
import ErrorDetails from '#lib/components/app/error-details.svelte';
import ErrorShell from '#lib/components/app/error-shell.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import { Path } from '#lib/routing/paths.ts';
import { refreshAll } from '$app/navigation';
import { resolve } from '$app/paths';
import { page } from '$app/state';

const NOT_FOUND_STATUS = 404;

let retrying = $state(false);
const notFound = $derived(page.status === NOT_FOUND_STATUS);

async function retry() {
	retrying = true;
	try {
		await refreshAll();
	} finally {
		retrying = false;
	}
}
</script>

<svelte:head>
	<title>
		{notFound ? 'Page not found' : 'Something went wrong'}
		· Snapflow
	</title>
</svelte:head>

{#snippet compassIcon()}
	<Compass class="size-5.5" />
{/snippet}

<div class="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-bg">
	{#if notFound}
		<ErrorShell
			title="Page not found"
			description="The page you're looking for doesn't exist or has been moved."
			icon={compassIcon}
		>
			<Chip leftIcon={ArrowLeft} onclick={() => history.back()}>Go back</Chip>
			<Chip href={resolve(Path.DASHBOARD)} variant="primary" leftIcon={House}>
				Return home
			</Chip>
		</ErrorShell>
	{:else}
		<ErrorShell
			title="Something went wrong"
			description={page.error?.message ??
				'An unexpected error occurred. Please try again or refresh the page.'}
		>
			<Chip variant="primary" disabled={retrying} onclick={() => void retry()}>
				{retrying ? 'Retrying...' : 'Try again'}
			</Chip>
		</ErrorShell>
		{#if page.error?.details}
			<ErrorDetails
				class="mx-auto mb-12 w-full max-w-lg"
				details={page.error.details}
			/>
		{/if}
	{/if}
</div>
