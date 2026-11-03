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

export interface AccountRowAction {
	icon?: IconComponent;
	label: string;
	onSelect: () => void;
	destructive?: boolean;
	disabled?: boolean;
}

interface AccountRowMenuProps {
	label: string;
	actions: readonly AccountRowAction[];
}
</script>

<script lang="ts">
import Ellipsis from '@lucide/svelte/icons/ellipsis';
import { chipVariants } from '#lib/components/ui/chip/chip.svelte';
import DropdownMenu from '#lib/components/ui/dropdown-menu/dropdown-menu.svelte';
import DropdownMenuContent from '#lib/components/ui/dropdown-menu/dropdown-menu-content.svelte';
import DropdownMenuItem from '#lib/components/ui/dropdown-menu/dropdown-menu-item.svelte';
import { MENU_LABEL_CLASS } from '#lib/components/ui/dropdown-menu/dropdown-menu-styles.ts';
import DropdownMenuTrigger from '#lib/components/ui/dropdown-menu/dropdown-menu-trigger.svelte';

let { label, actions }: AccountRowMenuProps = $props();
</script>

<DropdownMenu>
	<DropdownMenuTrigger>
		{#snippet child({
			props,
		})}
			<button
				{...props}
				type="button"
				aria-label={label}
				class={chipVariants()}
			>
				<Ellipsis class="size-3.5 shrink-0 text-(--text-icon)" />
			</button>
		{/snippet}
	</DropdownMenuTrigger>
	<DropdownMenuContent align="end">
		{#each actions as action (action.label)}
			<DropdownMenuItem
				destructive={action.destructive}
				disabled={action.disabled}
				onSelect={action.onSelect}
			>
				{#if action.icon}
					<action.icon />
				{/if}
				<span class={MENU_LABEL_CLASS}>{action.label}</span>
			</DropdownMenuItem>
		{/each}
	</DropdownMenuContent>
</DropdownMenu>
