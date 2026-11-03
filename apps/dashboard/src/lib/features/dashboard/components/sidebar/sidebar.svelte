<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const SANDBOXES_ITEM_ID = 'sandboxes';
</script>

<script lang="ts">
import ChevronLeft from '@lucide/svelte/icons/chevron-left';
import PanelLeft from '@lucide/svelte/icons/panel-left';
import Search from '@lucide/svelte/icons/search';
import Chip from '#lib/components/ui/chip/chip.svelte';
import { scrollEdges } from '#lib/components/ui/overflow/scroll-fade.ts';
import Tooltip from '#lib/components/ui/tooltip/tooltip.svelte';
import {
	SIDEBAR_COLLAPSED_SECTION_GAP_CLASS,
	SIDEBAR_DIVIDER_PAD_ABOVE_CLASS,
	SIDEBAR_DIVIDER_PAD_BELOW_CLASS,
	SIDEBAR_ITEM_GAP_CLASS,
	SIDEBAR_RAIL_CHIP_CLASS,
	SIDEBAR_SECTION_GAP_CLASS,
} from '#lib/features/dashboard/lib/sidebar-constants.ts';
import {
	DASHBOARD_ITEM_ICONS,
	type DashboardNavigationGroupView,
	getDashboardNavigation,
} from '#lib/features/dashboard/state/dashboard-navigation.svelte.ts';

import { getGlobalCommands } from '#lib/features/dashboard/state/global-commands.svelte.ts';
import { getSidebar } from '#lib/features/dashboard/state/sidebar.svelte.ts';
import { Path, resolvePath } from '#lib/routing/paths.ts';
import { shortcutLabel } from '#lib/utils/keyboard.ts';
import { cn } from '#lib/utils/utils.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import SandboxesRailFlyout from './sandboxes-rail-flyout.svelte';
import SidebarFooter from './sidebar-footer.svelte';
import SidebarNavChip from './sidebar-nav-chip.svelte';
import SidebarOrgSwitcher from './sidebar-org-switcher.svelte';
import SidebarSection from './sidebar-section.svelte';

interface SidebarProps {
	collapsed: boolean;
}

let { collapsed }: SidebarProps = $props();

const sidebar = getSidebar();
const navigation = getDashboardNavigation();
const commands = getGlobalCommands();
let scrolledTop = $state(false);
let scrolledBottom = $state(false);

const backTarget = $derived(
	navigation.inSettings
		? navigation.returnUrl
		: navigation.inAdminArea
			? resolve(Path.SANDBOXES)
			: null
);
const sections: readonly DashboardNavigationGroupView[] = $derived(
	navigation.inSettings ? navigation.settings : navigation.sections
);

const trackEdges = scrollEdges((edges) => {
	scrolledTop = edges.top;
	scrolledBottom = edges.bottom;
});
</script>

<aside
	class="group/rail relative h-full overflow-hidden bg-surface-1 [&_.group.cursor-pointer]:duration-0"
	data-collapsed={collapsed || undefined}
	aria-label="Sidebar"
>
	<div class="flex h-full flex-col">
		<div class="relative flex shrink-0 items-center px-2 pt-2">
			<SidebarOrgSwitcher
				{collapsed}
				onExpand={() => sidebar.setCollapsed(false)}
			/>
			<div
				inert={collapsed}
				class={cn(
					'flex h-7.5 items-center gap-px overflow-hidden max-md:min-h-11',
					collapsed ? 'w-0 opacity-0' : 'w-16.25'
				)}
			>
				<Tooltip
					content="Search"
					shortcut={shortcutLabel('K')}
					disabled={collapsed}
				>
					{#snippet child({
						props,
					})}
						<Chip
							{...props}
							leftIcon={Search}
							aria-label="Search"
							tabindex={collapsed ? -1 : undefined}
							onclick={commands.togglePalette}
						/>
					{/snippet}
				</Tooltip>
				<Tooltip
					content="Collapse sidebar"
					shortcut={shortcutLabel('B')}
					disabled={collapsed}
				>
					{#snippet child({
						props,
					})}
						<Chip
							{...props}
							leftIcon={PanelLeft}
							aria-label="Collapse sidebar"
							tabindex={collapsed ? -1 : undefined}
							class="max-md:hidden"
							onclick={sidebar.toggle}
						/>
					{/snippet}
				</Tooltip>
			</div>
		</div>

		<div
			class={cn(
				SIDEBAR_SECTION_GAP_CLASS,
				SIDEBAR_ITEM_GAP_CLASS,
				SIDEBAR_DIVIDER_PAD_ABOVE_CLASS,
				'flex shrink-0 flex-col border-b px-2 transition-colors duration-150',
				!scrolledTop && 'border-transparent'
			)}
		>
			{#if backTarget}
				<Tooltip content="Back" disabled={!collapsed}>
					{#snippet child({
						props,
					})}
						<Chip
							{...props}
							fullWidth
							leftIcon={ChevronLeft}
							class={SIDEBAR_RAIL_CHIP_CLASS}
							onclick={() => void goto(backTarget)}
						>
							<span class="sidebar-collapse-hide">Back</span>
						</Chip>
					{/snippet}
				</Tooltip>
			{:else}
				{#each navigation.primary as item (item.id)}
					{#if collapsed && item.id === SANDBOXES_ITEM_ID}
						<SandboxesRailFlyout
							label={item.label}
							icon={DASHBOARD_ITEM_ICONS[item.id]}
							href={resolvePath(item.path)}
							active={navigation.isActive(item.path)}
						/>
					{:else}
						<SidebarNavChip
							label={item.label}
							icon={DASHBOARD_ITEM_ICONS[item.id]}
							href={resolvePath(item.path)}
							active={navigation.isActive(item.path)}
							showTooltip={collapsed}
						/>
					{/if}
				{/each}
			{/if}
		</div>

		<div
			{@attach trackEdges}
			class={cn(
				SIDEBAR_DIVIDER_PAD_BELOW_CLASS,
				SIDEBAR_DIVIDER_PAD_ABOVE_CLASS,
				'scroll-fade flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden'
			)}
		>
			<div class="flex flex-col">
				{#each sections as group, index (group.id)}
					<SidebarSection
						title={group.label}
						railCollapsed={collapsed}
						divided={index > 0}
						class={cn(
							index > 0 &&
								(collapsed
									? SIDEBAR_COLLAPSED_SECTION_GAP_CLASS
									: SIDEBAR_SECTION_GAP_CLASS),
							'shrink-0 transition-[margin] duration-(--sidebar-motion-duration) ease-(--sidebar-motion-ease)'
						)}
					>
						<div class={cn(SIDEBAR_ITEM_GAP_CLASS, 'flex flex-col px-2')}>
							{#each group.items as item (item.id)}
								<SidebarNavChip
									label={item.label}
									icon={DASHBOARD_ITEM_ICONS[item.id]}
									href={resolvePath(item.path)}
									active={navigation.isActive(item.path)}
									showTooltip={collapsed}
								/>
							{/each}
						</div>
					</SidebarSection>
				{/each}
			</div>
		</div>

		<SidebarFooter {collapsed} showDivider={scrolledBottom} />
	</div>
</aside>
