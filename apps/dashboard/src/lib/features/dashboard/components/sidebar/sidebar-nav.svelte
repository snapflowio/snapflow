<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const MAIN_LABEL = 'Main';
</script>

<script lang="ts">
import { scrollEdges } from '#lib/components/ui/overflow/scroll-fade.ts';
import {
	SIDEBAR_GROUP_LABEL_CLASS,
	SIDEBAR_LIST_CLASS,
} from '#lib/features/dashboard/lib/sidebar-constants.ts';
import {
	type DashboardNavigationItemView,
	getDashboardNavigation,
} from '#lib/features/dashboard/state/dashboard-navigation.svelte.ts';
import { SidebarNavCounts } from '#lib/features/dashboard/state/sidebar-nav-counts.svelte.ts';
import SidebarNavChip from './sidebar-nav-chip.svelte';

const navigation = getDashboardNavigation();
const counts = new SidebarNavCounts();
const area = $derived(navigation.area);

const trackEdges = scrollEdges();
</script>

{#snippet list(items: readonly DashboardNavigationItemView[])}
	<ul class={SIDEBAR_LIST_CLASS}>
		{#each items as item (item.id)}
			{const active = $derived(navigation.isActive(item))}
			<SidebarNavChip
				{item}
				{active}
				activeSub={active ? navigation.activeSub(item) : undefined}
				count={counts.of(item.id)}
			/>
		{/each}
	</ul>
{/snippet}

<nav
	{@attach trackEdges}
	aria-label={area?.label ?? MAIN_LABEL}
	class="scroll-fade scrollbar-none flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden px-2 py-2"
>
	<div
		class="flex flex-col gap-2 animate-in fade-in-0 duration-1000 motion-reduce:animate-none"
	>
		{#if area}
			<div class="flex w-full flex-col gap-6">
				{#each area.groups as group, index (group.id)}
					<div class="flex w-full flex-col gap-2">
						{#if index > 0 && group.label}
							<span class={SIDEBAR_GROUP_LABEL_CLASS}>{group.label}</span>
						{/if}
						{@render list(group.items)}
					</div>
				{/each}
			</div>
		{:else}
			{@render list(navigation.top)}
		{/if}
	</div>
</nav>
