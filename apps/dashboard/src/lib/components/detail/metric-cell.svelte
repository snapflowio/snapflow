<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
export type MetricCellSize = 'md' | 'lg';

const VALUE_CLASS: Record<MetricCellSize, string> = {
	md: 'heading-s',
	lg: 'heading-l',
};
</script>

<script lang="ts">
import type { Snippet } from 'svelte';
import { EMPTY_CELL_PLACEHOLDER } from '#lib/components/resource/table/resource-table.ts';
import { cn } from '#lib/utils/utils.ts';

interface MetricCellProps {
	title: string;
	context?: string;
	value?: string | null;
	caption?: string | null;
	size?: MetricCellSize;
	children?: Snippet;
	legend?: Snippet;
	chart?: Snippet;
}

let {
	title,
	context,
	value,
	caption,
	size = 'lg',
	children,
	legend,
	chart,
}: MetricCellProps = $props();
</script>

<div class="flex min-w-0 flex-col gap-y-4 p-6">
	<h3 class="text-pretty text-(--text-primary) text-lg">
		{title}
		{#if context}
			<span class="ml-3 text-(--text-subtle)">{context}</span>
		{/if}
	</h3>
	<div class="flex min-w-0 flex-col gap-2">
		<div class={cn('wrap-break-word min-w-0 text-pretty', VALUE_CLASS[size])}>
			{#if children}
				{@render children()}
			{:else if value}
				{value}
			{:else}
				<span class="text-(--text-disabled)">{EMPTY_CELL_PLACEHOLDER}</span>
			{/if}
		</div>
		{#if caption}
			<p class="text-pretty text-(--text-subtle) text-sm">{caption}</p>
		{/if}
		{#if legend}
			<div
				class="flex flex-col gap-x-6 gap-y-2 text-sm md:flex-row md:items-center"
			>
				{@render legend()}
			</div>
		{/if}
	</div>
	{#if chart}
		<div class="mt-auto min-w-0">{@render chart()}</div>
	{/if}
</div>
