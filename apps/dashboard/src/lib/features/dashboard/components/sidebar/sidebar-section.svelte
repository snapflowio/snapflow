<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const TITLE_ROW_CLASS = 'flex h-full min-w-0 flex-1 items-center gap-2 px-4';
</script>

<script lang="ts">
import ChevronDown from '@lucide/svelte/icons/chevron-down';
import type { Snippet } from 'svelte';
import type { ClassValue } from 'svelte/elements';
import { disclosureChevronClass } from '#lib/components/ui/chip/chip-chrome.ts';
import OverflowText from '#lib/components/ui/overflow/overflow-text.svelte';
import { cn } from '#lib/utils/utils.ts';

interface SidebarSectionProps {
	title: string;
	action?: Snippet;
	railCollapsed?: boolean;
	divided?: boolean;
	class?: ClassValue;
	children: Snippet;
}

let {
	title,
	action,
	railCollapsed = false,
	divided = false,
	class: className,
	children,
}: SidebarSectionProps = $props();

let expanded = $state(true);
</script>

{#snippet label()}
	<OverflowText
		text={title}
		class="sidebar-collapse-hide text-(--text-muted) text-caption"
	/>
{/snippet}

<div class={cn('group/section flex flex-col', className)}>
	{#if railCollapsed && divided}
		<div
			aria-hidden="true"
			class="mx-auto mb-2 h-px w-4 shrink-0 bg-border"
		></div>
	{/if}
	<div
		class={cn(
			'flex shrink-0 items-center overflow-hidden transition-[height,opacity] duration-(--sidebar-motion-duration) ease-(--sidebar-motion-ease)',
			railCollapsed ? 'h-0 opacity-0' : 'h-4.5 max-md:pointer-coarse:h-11'
		)}
	>
		{#if railCollapsed}
			<div class={TITLE_ROW_CLASS}>{@render label()}</div>
		{:else}
			<button
				type="button"
				aria-expanded={expanded}
				onclick={() => (expanded = !expanded)}
				class={cn('group/toggle cursor-pointer outline-none', TITLE_ROW_CLASS)}
			>
				{@render label()}
				<ChevronDown
					class={cn(
						disclosureChevronClass,
						'opacity-0 group-hover/section:opacity-100 group-focus-visible/toggle:opacity-100 max-md:pointer-coarse:opacity-100',
						!expanded && '-rotate-90'
					)}
				/>
			</button>
		{/if}
		{#if action}
			<div class="flex shrink-0 items-center pr-4">{@render action()}</div>
		{/if}
	</div>
	{#if railCollapsed || expanded}
		<div
			class={cn(
				'transition-[padding] duration-(--sidebar-motion-duration) ease-(--sidebar-motion-ease)',
				railCollapsed ? 'pt-0' : 'pt-1.5'
			)}
		>
			{@render children()}
		</div>
	{/if}
</div>
