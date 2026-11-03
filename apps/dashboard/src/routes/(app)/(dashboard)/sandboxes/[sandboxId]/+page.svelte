<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { MediaQuery } from 'svelte/reactivity';
import { breakpointQuery } from '#lib/components/layouts/breakpoints.ts';
import ScrollArea from '#lib/components/ui/scroll-area.svelte';
import SandboxOverviewPanel from '#lib/features/sandboxes/components/overview/sandbox-overview-panel.svelte';
import { firstSandboxContentTabHref } from '#lib/features/sandboxes/lib/sandbox-detail-tabs.ts';
import { getSandboxDetail } from '#lib/features/sandboxes/state/sandbox-detail.svelte.ts';
import { goto } from '$app/navigation';

const detail = getSandboxDetail();
const isDesktop = new MediaQuery(breakpointQuery('lg'));

$effect(() => {
	if (!isDesktop.current) return;
	void goto(firstSandboxContentTabHref(detail.sandbox.id, detail.canWrite), {
		replace: true,
	});
});
</script>

<svelte:head>
	<title>Overview · {detail.sandbox.name} · Snapflow</title>
</svelte:head>

{#if !isDesktop.current}
	<ScrollArea aria-label="Sandbox overview" class="flex-1">
		<SandboxOverviewPanel />
	</ScrollArea>
{/if}
