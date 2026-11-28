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
import ErrorShell from '#lib/components/app/error-shell.svelte';
import SectionError from '#lib/components/app/section-error.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import { Path } from '#lib/routing/paths.ts';
import { refreshAll } from '$app/navigation';
import { resolve } from '$app/paths';
import { page } from '$app/state';

const NOT_FOUND_STATUS = 404;
const NOT_FOUND_TITLE = 'Page not found';
const ERROR_TITLE = 'Something went wrong';

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
	<title>{notFound ? NOT_FOUND_TITLE : ERROR_TITLE} · Snapflow</title>
</svelte:head>

{#snippet compassIcon()}
	<Compass class="size-5.5" />
{/snippet}

<div class="flex h-full min-h-0 flex-1 flex-col overflow-y-auto">
	{#if notFound}
		<ErrorShell
			title={NOT_FOUND_TITLE}
			description="It may have moved, or the link is wrong."
			icon={compassIcon}
		>
			<Chip leftIcon={ArrowLeft} onclick={() => history.back()}>Go back</Chip>
			<Chip href={resolve(Path.DASHBOARD)} variant="primary"
				>Go to dashboard</Chip
			>
		</ErrorShell>
	{:else}
		<SectionError
			title={page.error?.message ?? ERROR_TITLE}
			details={page.error?.details}
			backHref={resolve(Path.DASHBOARD)}
			backLabel="Go to dashboard"
			{retrying}
			onRetry={() => void retry()}
		/>
	{/if}
</div>
