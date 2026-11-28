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
import { Path, resolvePath } from '#lib/routing/paths.ts';
import { refreshAll } from '$app/navigation';
import { page } from '$app/state';

const TITLE = "Settings couldn't load";

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
	<title>Settings unavailable · Snapflow</title>
</svelte:head>

<SectionError
	title={TITLE}
	details={page.error?.message}
	backHref={resolvePath(Path.SETTINGS)}
	backLabel="Back to settings"
	{retrying}
	onRetry={() => void retry()}
/>
