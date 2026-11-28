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
import Skeleton from '#lib/components/ui/skeleton/skeleton.svelte';
import { cn } from '#lib/utils/utils.ts';

interface WellProps {
	title: string;
	info?: string;
	actions?: Snippet;
	children?: Snippet;
	footer?: Snippet;
	loading?: boolean;
	class?: ClassValue;
}

let {
	title,
	info,
	actions,
	children,
	footer,
	loading = false,
	class: className,
}: WellProps = $props();

const titleId = $props.id();
</script>

<section
	aria-labelledby={titleId}
	class={cn(
		'@container/well flex min-w-0 flex-1 flex-col justify-start gap-y-4 rounded-2xl bg-surface-3 p-6',
		className
	)}
>
	<div class="flex min-h-10 flex-row items-center justify-between gap-x-4">
		<h2 id={titleId} class="heading-xxs min-w-0 flex-1 text-pretty">
			{title}
		</h2>
		{#if actions}
			<div class="flex shrink-0 items-center">
				{@render actions()}
			</div>
		{/if}
	</div>
	{#if loading}
		<div class="heading-s">
			<Skeleton class="h-[1.375em] w-36 rounded-lg" />
		</div>
	{:else}
		<div class="flex min-w-0 items-start gap-x-2">
			<div class="flex min-w-0 flex-col gap-y-2 overflow-hidden">
				{@render children?.()}
			</div>
			{#if info}
				<span class="mt-2.5 flex shrink-0 md:mt-3">
					<InfoTooltip content={info} />
				</span>
			{/if}
		</div>
	{/if}
	{#if footer && !loading}
		<div
			class="mt-auto flex min-w-0 flex-col gap-y-2 text-(--text-muted) text-sm"
		>
			{@render footer()}
		</div>
	{/if}
</section>
