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
import { PAGE_HEADING_CLASS } from '#lib/components/ui/chip/chip-chrome.ts';

interface ErrorShellProps {
	title: string;
	description: string;
	icon?: Snippet;
	children?: Snippet;
}

let { title, description, icon, children }: ErrorShellProps = $props();
</script>

<div class="flex h-full flex-1 items-center justify-center bg-bg px-6 py-12">
	<div class="flex w-full max-w-105 flex-col items-center gap-5 text-center">
		<div
			class="size-13 shrink-0 rounded-2xl border border-border bg-surface-5 p-0.75 shadow-xs"
		>
			<div
				class="flex size-full items-center justify-center rounded-[11px] border border-border bg-bg text-(--text-icon)"
			>
				{#if icon}
					{@render icon()}
				{:else}
					<TriangleAlert class="size-5.5" />
				{/if}
			</div>
		</div>
		<div class="flex flex-col items-center gap-2">
			<h2 class={PAGE_HEADING_CLASS}>{title}</h2>
			<p class="max-w-85 text-(--text-tertiary) text-sm leading-[1.55]">
				{description}
			</p>
		</div>
		{#if children}
			<div class="flex flex-wrap items-center justify-center gap-2 pt-1">
				{@render children()}
			</div>
		{/if}
	</div>
</div>
