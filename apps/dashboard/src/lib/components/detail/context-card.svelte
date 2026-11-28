<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
export const CONTEXT_CARD_CLASS =
	'flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-surface-1 p-6';
const STACKED_KEY_VALUE_CLASS =
	'[&_[data-kv-row]]:md:flex-col [&_[data-kv-row]]:md:items-stretch [&_[data-kv-row]]:md:gap-0.5 [&_[data-kv-label]]:md:basis-auto [&_[data-kv-value]]:md:justify-start [&_[data-kv-value]]:md:px-0 [&_[data-kv-value]]:md:text-left';
</script>

<script lang="ts">
import type { Snippet } from 'svelte';
import type { ClassValue } from 'svelte/elements';
import { cn } from '#lib/utils/utils.ts';

interface ContextCardProps {
	title?: string;
	action?: Snippet;
	children: Snippet;
	class?: ClassValue;
}

let { title, action, children, class: className }: ContextCardProps = $props();

const titleId = $props.id();
</script>

<section
	data-context-card=""
	aria-labelledby={title ? titleId : undefined}
	class={cn(CONTEXT_CARD_CLASS, STACKED_KEY_VALUE_CLASS, className)}
>
	{#if title || action}
		<div class="flex min-w-0 items-center justify-between gap-4">
			{#if title}
				<h2 id={titleId} class="text-pretty text-(--text-primary) text-lg">
					{title}
				</h2>
			{/if}
			{#if action}
				<div class="ml-auto flex shrink-0 items-center gap-2">
					{@render action()}
				</div>
			{/if}
		</div>
	{/if}
	{@render children()}
</section>
