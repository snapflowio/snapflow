<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { DashboardNavigationItemView } from '#lib/features/dashboard/state/dashboard-navigation.svelte.ts';
import type {
	SidebarNavCount,
	SidebarNavCountTone,
} from '#lib/features/dashboard/state/sidebar-nav-counts.svelte.ts';

const COUNT_TONE_CLASS: Record<SidebarNavCountTone, string> = {
	default: 'text-(--text-subtle)',
	error: 'text-(--text-error)',
};

interface SidebarNavChipProps {
	item: DashboardNavigationItemView;
	active: boolean;
	activeSub?: DashboardNavigationItemView;
	count?: SidebarNavCount;
}
</script>

<script lang="ts">
import {
	SIDEBAR_COUNT_CLASS,
	SIDEBAR_ITEM_ACTIVE_CLASS,
	SIDEBAR_ITEM_CLASS,
	SIDEBAR_ITEM_ICON_CLASS,
	SIDEBAR_ITEM_IDLE_CLASS,
	SIDEBAR_ITEM_LABEL_CLASS,
	SIDEBAR_SUB_ITEM_CLASS,
	SIDEBAR_SUB_LIST_CLASS,
} from '#lib/features/dashboard/lib/sidebar-constants.ts';
import { DASHBOARD_ITEM_ICONS } from '#lib/features/dashboard/state/dashboard-navigation.svelte.ts';
import { getSidebar } from '#lib/features/dashboard/state/sidebar.svelte.ts';
import { resolvePath } from '#lib/routing/paths.ts';
import { cn } from '#lib/utils/utils.ts';
import SidebarTooltip from './sidebar-tooltip.svelte';

let { item, active, activeSub, count }: SidebarNavChipProps = $props();

const sidebar = getSidebar();
const Icon = $derived(DASHBOARD_ITEM_ICONS[item.id]);
const subs = $derived(active ? item.subs : undefined);
</script>

<li class="relative">
	<SidebarTooltip label={item.label}>
		{#snippet child({ props })}
			<a
				{...props}
				href={resolvePath(item.path)}
				aria-current={active && (!subs || sidebar.collapsed)
					? 'page'
					: undefined}
				class={cn(
					SIDEBAR_ITEM_CLASS,
					active ? SIDEBAR_ITEM_ACTIVE_CLASS : SIDEBAR_ITEM_IDLE_CLASS
				)}
			>
				<Icon aria-hidden="true" class={SIDEBAR_ITEM_ICON_CLASS} />
				<span class={SIDEBAR_ITEM_LABEL_CLASS}>{item.label}</span>
				{#if count}
					<span
						class={cn(
							'ml-auto shrink-0 text-xs tabular-nums leading-none',
							SIDEBAR_COUNT_CLASS,
							COUNT_TONE_CLASS[count.tone]
						)}
					>
						<span aria-hidden="true">{count.value}</span>
						<span class="sr-only">{count.label}</span>
					</span>
				{/if}
			</a>
		{/snippet}
	</SidebarTooltip>
	{#if subs}
		<ul class={SIDEBAR_SUB_LIST_CLASS}>
			{#each subs as sub (sub.id)}
				{const current = $derived(sub.id === activeSub?.id)}
				<li>
					<a
						href={resolvePath(sub.path)}
						aria-current={current ? 'page' : undefined}
						class={cn(
							SIDEBAR_SUB_ITEM_CLASS,
							current ? 'text-(--text-primary)' : 'text-(--text-subtle)'
						)}
					>
						{sub.label}
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</li>
