<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { ResourceRowAction } from './resource-row-action.ts';

interface ResourceRowActionsProps {
	actions: readonly ResourceRowAction[];
	label: string;
}

const ROW_ACTIONS_SIDE_OFFSET = 4;
</script>

<script lang="ts">
import MoreHorizontal from '@lucide/svelte/icons/ellipsis';
import DropdownMenu from '#lib/components/ui/dropdown-menu/dropdown-menu.svelte';
import DropdownMenuContent from '#lib/components/ui/dropdown-menu/dropdown-menu-content.svelte';
import DropdownMenuTrigger from '#lib/components/ui/dropdown-menu/dropdown-menu-trigger.svelte';
import ResourceRowActionItems from './resource-row-action-items.svelte';

let { actions, label }: ResourceRowActionsProps = $props();

const hasVisibleActions = $derived(
	actions.some((action) => action.visible !== false)
);
</script>

{#if hasVisibleActions}
	<DropdownMenu>
		<DropdownMenuTrigger
			type="button"
			aria-label={label}
			class="flex size-4.5 cursor-pointer items-center justify-center rounded-sm text-(--text-icon) opacity-0 outline-none transition-opacity focus-visible:opacity-100 group-focus-within/row-actions:opacity-100 group-hover/row-actions:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100"
			onclick={(event: MouseEvent) => event.stopPropagation()}
		>
			<MoreHorizontal class="size-4" />
		</DropdownMenuTrigger>
		<DropdownMenuContent align="end" sideOffset={ROW_ACTIONS_SIDE_OFFSET}>
			<ResourceRowActionItems {actions} />
		</DropdownMenuContent>
	</DropdownMenu>
{/if}
