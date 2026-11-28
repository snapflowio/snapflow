<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { Snippet } from 'svelte';
import type { ClassValue } from 'svelte/elements';
import InfoTooltip from '#lib/components/page/info-tooltip.svelte';
import { cn } from '#lib/utils/utils.ts';

interface DetailSectionProps {
	title: string;
	info?: string;
	action?: Snippet;
	separated?: boolean;
	children: Snippet;
	class?: ClassValue;
}

let {
	title,
	info,
	action,
	separated = true,
	children,
	class: className,
}: DetailSectionProps = $props();

const titleId = $props.id();
</script>

<section
	aria-labelledby={titleId}
	class={cn(
		'flex min-w-0 flex-col gap-y-6',
		separated && 'border-border border-t pt-12 first:border-t-0 first:pt-0',
		className
	)}
>
	<div class="flex min-h-8 items-center justify-between gap-x-4">
		<div class="flex min-w-0 items-center gap-x-2">
			<h2 id={titleId} class="truncate heading-xxs">{title}</h2>
			{#if info}
				<InfoTooltip content={info} />
			{/if}
		</div>
		{#if action}
			<div class="flex shrink-0 items-center gap-x-2">{@render action()}</div>
		{/if}
	</div>
	{@render children()}
</section>
