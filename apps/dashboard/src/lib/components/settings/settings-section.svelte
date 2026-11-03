<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { Snippet } from 'svelte';

type TextContent = string | Snippet;
</script>

<script lang="ts">
import type { ClassValue } from 'svelte/elements';
import { cn } from '#lib/utils/utils.ts';

interface SettingsSectionProps {
	title: TextContent;
	description?: TextContent;
	accessory?: Snippet;
	action?: Snippet;
	children: Snippet;
	class?: ClassValue;
	tone?: 'default' | 'danger';
}

let {
	title,
	description,
	accessory,
	action,
	children,
	class: className,
	tone = 'default',
}: SettingsSectionProps = $props();

const titleId = $props.id();
</script>

{#snippet text(
	content: TextContent
)}
	{#if typeof content === 'string'}
		{content}
	{:else}
		{@render content()}
	{/if}
{/snippet}

<section aria-labelledby={titleId} class={cn('flex flex-col', className)}>
	<div class="flex min-w-0 items-center gap-1.5 pl-0.5">
		<h2
			id={titleId}
			class={cn(
				'text-small',
				tone === 'danger' ? 'text-(--text-error)' : 'text-(--text-muted)'
			)}
		>
			{@render text(title)}
		</h2>
		{@render accessory?.()}
		{#if action}
			<div class="ml-auto flex shrink-0 items-center gap-1">
				{@render action()}
			</div>
		{/if}
	</div>
	<div class="mt-2.25 mb-3 h-px bg-border"></div>
	{#if description}
		<p class="-mt-1 mb-3 pl-0.5 text-(--text-muted) text-caption">
			{@render text(description)}
		</p>
	{/if}
	{@render children()}
</section>
