<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
import type { Snippet } from 'svelte';
import { PAGE_TITLE_CLASS } from '#lib/components/page/page-layout.ts';

interface ErrorShellProps {
	title: string;
	description: string;
	icon?: Snippet;
	children?: Snippet;
}

let { title, description, icon, children }: ErrorShellProps = $props();
</script>

<div class="flex h-full flex-1 items-center justify-center px-4 py-12">
	<div
		class="flex w-full max-w-md flex-col items-center gap-8 rounded-3xl bg-surface-1 p-8 text-center sm:p-12"
	>
		<div class="flex items-center justify-center text-(--text-muted)">
			{#if icon}
				{@render icon()}
			{:else}
				<TriangleAlert class="size-8" />
			{/if}
		</div>
		<div class="flex flex-col items-center gap-2">
			<h1 class={PAGE_TITLE_CLASS}>{title}</h1>
			<p class="max-w-sm text-balance text-(--text-muted) text-sm">
				{description}
			</p>
		</div>
		{#if children}
			<div
				class="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-center"
			>
				{@render children()}
			</div>
		{/if}
	</div>
</div>
