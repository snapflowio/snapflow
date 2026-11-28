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
import { refreshAll } from '$app/navigation';
import { page } from '$app/state';

let retrying = $state(false);

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
	<title>Earnings unavailable · Snapflow</title>
</svelte:head>

<SectionError
	title="Couldn't load earnings"
	details={page.error?.message}
	{retrying}
	onRetry={() => void retry()}
/>
