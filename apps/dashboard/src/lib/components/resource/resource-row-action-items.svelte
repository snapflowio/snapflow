<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import DropdownMenuItem from '#lib/components/ui/dropdown-menu/dropdown-menu-item.svelte';
import DropdownMenuSeparator from '#lib/components/ui/dropdown-menu/dropdown-menu-separator.svelte';
import { MENU_LABEL_CLASS } from '#lib/components/ui/dropdown-menu/dropdown-menu-styles.ts';
import {
	orderRowActions,
	type ResourceRowAction,
} from './resource-row-action.ts';

interface ResourceRowActionItemsProps {
	actions: readonly ResourceRowAction[];
}

let { actions }: ResourceRowActionItemsProps = $props();

const ordered = $derived(orderRowActions(actions));

function startsGroup(index: number): boolean {
	if (index === 0) return false;
	const action = ordered[index];
	const previous = ordered[index - 1];
	if (!action || !previous) return false;
	return (
		Boolean(action.separated) ||
		(Boolean(action.destructive) && !previous.destructive)
	);
}
</script>

{#each ordered as action, index (action.label)}
	{#if startsGroup(index)}
		<DropdownMenuSeparator />
	{/if}
	<DropdownMenuItem
		destructive={action.destructive}
		disabled={action.disabled}
		disabledReason={action.disabledReason}
		shortcut={action.shortcut}
		onSelect={action.onSelect}
	>
		{#if action.icon}
			<action.icon />
		{/if}
		<span class={MENU_LABEL_CLASS}>{action.label}</span>
	</DropdownMenuItem>
{/each}
