<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
export interface ResourceTab {
	label: string;
	href: string;
	active: boolean;
	count?: number;
	visible?: boolean;
}

const TAB_CLASS =
	'inline-flex items-center gap-2 whitespace-nowrap rounded-md outline-none transition-colors duration-(--motion-quick) focus-visible:focus-ring';
const LIST_CLASS = 'gap-x-6';
const TAB_SIZE_CLASS = 'text-base md:text-xl';
</script>

<script lang="ts">
import type { ClassValue } from 'svelte/elements';
import Badge from '#lib/components/ui/badge.svelte';
import { scrollEdges } from '#lib/components/ui/overflow/scroll-fade.ts';
import { cn } from '#lib/utils/utils.ts';

interface ResourceTabsProps {
	tabs: readonly ResourceTab[];
	label: string;
	class?: ClassValue;
}

let { tabs, label, class: className }: ResourceTabsProps = $props();

const shownTabs = $derived(tabs.filter((tab) => tab.visible !== false));
</script>

<nav
	aria-label={label}
	class={cn(
		'scroll-fade -m-0.5 min-w-0 overflow-x-auto overflow-y-hidden scrollbar-none',
		className
	)}
	{@attach scrollEdges()}
>
	<ul class={cn('flex items-end p-0.5', LIST_CLASS)}>
		{#each shownTabs as tab (tab.href)}
			<li class="shrink-0">
				<a
					href={tab.href}
					aria-current={tab.active ? 'page' : undefined}
					class={cn(
						TAB_CLASS,
						TAB_SIZE_CLASS,
						tab.active
							? 'text-(--text-primary)'
							: 'text-(--text-muted) hover-hover:text-(--text-primary)'
					)}
				>
					{tab.label}
					{#if tab.count !== undefined}
						<Badge size="pill">{tab.count}</Badge>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
</nav>
