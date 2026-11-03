<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import ArrowDown from '@lucide/svelte/icons/arrow-down';
import ArrowUp from '@lucide/svelte/icons/arrow-up';
import type { IconComponent } from '#lib/components/icons/icon-component.ts';
import type { ResourceSortState } from '#lib/components/resource/table/resource-table-sort.ts';

function sortDirectionIcon(
	active: ResourceSortState | null,
	column: string
): IconComponent | null {
	if (active?.column !== column) return null;
	return active.direction === 'asc' ? ArrowUp : ArrowDown;
}
</script>

<script lang="ts">
import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down';
import X from '@lucide/svelte/icons/x';
import Chip from '#lib/components/ui/chip/chip.svelte';
import DropdownMenu from '#lib/components/ui/dropdown-menu/dropdown-menu.svelte';
import DropdownMenuContent from '#lib/components/ui/dropdown-menu/dropdown-menu-content.svelte';
import DropdownMenuItem from '#lib/components/ui/dropdown-menu/dropdown-menu-item.svelte';
import DropdownMenuSeparator from '#lib/components/ui/dropdown-menu/dropdown-menu-separator.svelte';
import { MENU_LABEL_CLASS } from '#lib/components/ui/dropdown-menu/dropdown-menu-styles.ts';
import DropdownMenuTrigger from '#lib/components/ui/dropdown-menu/dropdown-menu-trigger.svelte';
import {
	MENU_OFFSET_PX,
	nextSortDirection,
	type ResourceMenuControlProps,
	type ResourceSortConfig,
	sortAriaLabel,
} from './resource-options.ts';

let {
	onOpenChange,
	open,
	sort,
}: ResourceMenuControlProps & { sort: ResourceSortConfig } = $props();
</script>

<DropdownMenu modal={false} {open} {onOpenChange}>
	<DropdownMenuTrigger>
		{#snippet child({
			props,
		})}
			<Chip {...props} active={Boolean(sort.active)} leftIcon={ArrowUpDown}>
				Sort
			</Chip>
		{/snippet}
	</DropdownMenuTrigger>
	<DropdownMenuContent
		align="end"
		alignOffset={MENU_OFFSET_PX}
		class="max-h-(--bits-dropdown-menu-content-available-height)"
	>
		{#if sort.active && sort.onClear}
			<DropdownMenuItem onSelect={sort.onClear}>
				<X />
				<span class={MENU_LABEL_CLASS}>Clear sort</span>
			</DropdownMenuItem>
			<DropdownMenuSeparator />
		{/if}
		{#each sort.options as option (option.id)}
			{const DirectionIcon = $derived(
				sortDirectionIcon(sort.active, option.id)
			)}
			<DropdownMenuItem
				aria-label={sortAriaLabel(option, sort.active)}
				onSelect={() =>
					sort.onSort(option.id, nextSortDirection(sort.active, option.id))}
			>
				<span class="min-w-0 flex-1 truncate">{option.label}</span>
				{#if DirectionIcon}
					<DirectionIcon class="ml-auto size-3 text-(--text-tertiary)" />
				{/if}
			</DropdownMenuItem>
		{/each}
	</DropdownMenuContent>
</DropdownMenu>
