<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { IconComponent } from '#lib/components/icons/icon-component.ts';
import type { SidebarHoverMenu } from '#lib/features/dashboard/state/sidebar-hover-menu.svelte.ts';

export interface SidebarRailFlyoutItem {
	id: string;
	label: string;
	href: string;
}

interface SidebarRailFlyoutProps {
	label: string;
	icon: IconComponent;
	href: string;
	active: boolean;
	items: readonly SidebarRailFlyoutItem[];
	loading?: boolean;
	emptyLabel: string;
	menu: SidebarHoverMenu;
}
</script>

<script lang="ts">
import Chip from '#lib/components/ui/chip/chip.svelte';
import DropdownMenu from '#lib/components/ui/dropdown-menu/dropdown-menu.svelte';
import DropdownMenuContent from '#lib/components/ui/dropdown-menu/dropdown-menu-content.svelte';
import DropdownMenuItem from '#lib/components/ui/dropdown-menu/dropdown-menu-item.svelte';
import DropdownMenuLabel from '#lib/components/ui/dropdown-menu/dropdown-menu-label.svelte';
import { MENU_LABEL_CLASS } from '#lib/components/ui/dropdown-menu/dropdown-menu-styles.ts';
import DropdownMenuTrigger from '#lib/components/ui/dropdown-menu/dropdown-menu-trigger.svelte';
import Spinner from '#lib/components/ui/spinner.svelte';
import {
	SIDEBAR_FLYOUT_SIDE_OFFSET,
	SIDEBAR_FLYOUT_WIDTH_CLASS,
	SIDEBAR_RAIL_CHIP_CLASS,
} from '#lib/features/dashboard/lib/sidebar-constants.ts';

let {
	label,
	icon,
	href,
	active,
	items,
	loading = false,
	emptyLabel,
	menu,
}: SidebarRailFlyoutProps = $props();
</script>

<DropdownMenu modal={false} bind:open={menu.open}>
	<DropdownMenuTrigger>
		{#snippet child({
			props,
		})}
			<Chip
				{...props}
				{...menu.triggerProps}
				{href}
				leftIcon={icon}
				{active}
				aria-label={label}
				fullWidth
				class={SIDEBAR_RAIL_CHIP_CLASS}
			>
				{label}
			</Chip>
		{/snippet}
	</DropdownMenuTrigger>
	<DropdownMenuContent
		{...menu.contentProps}
		side="right"
		align="start"
		sideOffset={SIDEBAR_FLYOUT_SIDE_OFFSET}
		class={SIDEBAR_FLYOUT_WIDTH_CLASS}
	>
		<DropdownMenuLabel>{label}</DropdownMenuLabel>
		{#if loading}
			<div class="flex justify-center py-3"><Spinner /></div>
		{:else}
			{#each items as item (item.id)}
				<DropdownMenuItem>
					{#snippet child({
						props,
					})}
						<a {...props} href={item.href}>
							<span class={MENU_LABEL_CLASS}>{item.label}</span>
						</a>
					{/snippet}
				</DropdownMenuItem>
			{:else}
				<div class="px-2 py-1.5 text-(--text-muted) text-small">
					{emptyLabel}
				</div>
			{/each}
		{/if}
	</DropdownMenuContent>
</DropdownMenu>
