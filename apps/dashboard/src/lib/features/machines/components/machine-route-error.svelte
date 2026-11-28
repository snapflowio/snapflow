<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import SectionError from '#lib/components/app/section-error.svelte';
import { Path } from '#lib/routing/paths.ts';
import { refreshAll } from '$app/navigation';
import { resolve } from '$app/paths';
import { page } from '$app/state';

const NOT_FOUND_STATUS = 404;

let retrying = $state(false);
const notFound = $derived(page.status === NOT_FOUND_STATUS);

async function retry(): Promise<void> {
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
		{notFound ? 'Machine not found' : 'Machines unavailable'}
		· Snapflow
	</title>
</svelte:head>

{#if notFound}
	<SectionError
		title="Machine not found"
		backHref={resolve(Path.MACHINES)}
		backLabel="Back to machines"
	/>
{:else}
	<SectionError
		title="Couldn't load machines"
		details={page.error?.message}
		backHref={resolve(Path.MACHINES)}
		backLabel="Back to machines"
		{retrying}
		onRetry={() => void retry()}
	/>
{/if}
