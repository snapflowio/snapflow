<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
import type { Snippet } from 'svelte';

interface WidgetCellProps {
	title: string;
	href?: string;
	hrefLabel?: string;
	headline?: Snippet;
	children?: Snippet;
}

let { title, href, hrefLabel, headline, children }: WidgetCellProps = $props();

const titleId = $props.id();
</script>

<section
	aria-labelledby={titleId}
	class="flex flex-col gap-6 overflow-hidden @3xl/widgets:h-82"
>
	<div class="flex shrink-0 flex-col gap-2 px-6 pt-6">
		<div class="flex h-6 items-center justify-between gap-3">
			<h3 id={titleId} class="truncate text-(--text-primary) text-sm">
				{title}
			</h3>
			{#if href}
				<a
					{href}
					aria-label={hrefLabel ?? title}
					class="flex size-6 shrink-0 items-center justify-center rounded-full text-(--text-subtle) outline-none transition-colors duration-(--motion-quick) hover-hover:bg-surface-5 hover-hover:text-(--text-primary) focus-visible:focus-ring"
				>
					<ArrowUpRight class="size-4" />
				</a>
			{/if}
		</div>
		{#if headline}
			<div class="truncate heading-m">{@render headline()}</div>
		{/if}
	</div>
	{#if children}
		<div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-4">
			{@render children()}
		</div>
	{/if}
</section>
