<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import {
	hasVisibleRowActions,
	MAX_QUICK_ROW_ACTIONS,
	type ResourceRowAction,
	visibleRowActions,
} from './resource-row-action.ts';

export type ResourceRowActionsReveal = 'hover' | 'always' | 'header';

interface ResourceRowActionsProps {
	actions: readonly ResourceRowAction[];
	label: string;
	quick?: readonly ResourceRowAction[];
	reveal?: ResourceRowActionsReveal;
}

const ROW_ACTIONS_SIDE_OFFSET = 4;
const HOVER_REVEAL_CLASS =
	'opacity-0 transition-opacity duration-(--motion-quick) focus-visible:opacity-100 group-focus-within/row:opacity-100 group-hover/row:opacity-100 group-focus-within/row-actions:opacity-100 group-hover/row-actions:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100';
</script>

<script lang="ts">
import MoreHorizontal from '@lucide/svelte/icons/ellipsis';
import { MOBILE_TOUCH_TARGET_CLASS } from '#lib/components/ui/chip/chip-chrome.ts';
import DropdownMenu from '#lib/components/ui/dropdown-menu/dropdown-menu.svelte';
import DropdownMenuContent from '#lib/components/ui/dropdown-menu/dropdown-menu-content.svelte';
import DropdownMenuTrigger from '#lib/components/ui/dropdown-menu/dropdown-menu-trigger.svelte';
import IconButton, {
	iconButtonVariants,
} from '#lib/components/ui/icon-button.svelte';
import { cn } from '#lib/utils/utils.ts';
import ResourceRowActionItems from './resource-row-action-items.svelte';

let {
	actions,
	label,
	quick = [],
	reveal = 'hover',
}: ResourceRowActionsProps = $props();

const hasVisibleActions = $derived(hasVisibleRowActions(actions));
const quickActions = $derived(
	visibleRowActions(quick).slice(0, MAX_QUICK_ROW_ACTIONS)
);
const hoverClass = $derived(reveal === 'hover' ? HOVER_REVEAL_CLASS : '');
const persistentTriggerClass = $derived(
	cn(
		iconButtonVariants({ variant: 'filled', size: 'md' }),
		reveal === 'header' && 'size-10'
	)
);
</script>

{#if hasVisibleActions || quickActions.length > 0}
	<div class="flex items-center gap-1">
		{#each quickActions as action (action.label)}
			<IconButton
				size="md"
				label={action.label}
				icon={action.icon}
				shortcut={action.shortcut}
				disabled={action.disabled}
				disabledReason={action.disabledReason}
				class={hoverClass}
				onclick={(event: MouseEvent) => {
					event.stopPropagation();
					action.onSelect();
				}}
			/>
		{/each}
		{#if hasVisibleActions}
			<DropdownMenu>
				{#if reveal !== 'hover'}
					<DropdownMenuTrigger>
						{#snippet child({ props })}
							<button
								{...props}
								type="button"
								aria-label={label}
								class={persistentTriggerClass}
							>
								<MoreHorizontal class="size-4 shrink-0" />
							</button>
						{/snippet}
					</DropdownMenuTrigger>
				{:else}
					<DropdownMenuTrigger
						type="button"
						aria-label={label}
						class={cn(
							'flex size-8 cursor-pointer items-center justify-center rounded-full text-(--text-muted) outline-none transition-colors duration-(--motion-quick) hover-hover:bg-surface-5 hover-hover:text-(--text-primary) focus-visible:focus-ring data-[state=open]:bg-surface-5 data-[state=open]:text-(--text-primary)',
							hoverClass,
							MOBILE_TOUCH_TARGET_CLASS
						)}
						onclick={(event: MouseEvent) => event.stopPropagation()}
					>
						<MoreHorizontal class="size-4" />
					</DropdownMenuTrigger>
				{/if}
				<DropdownMenuContent align="end" sideOffset={ROW_ACTIONS_SIDE_OFFSET}>
					<ResourceRowActionItems {actions} />
				</DropdownMenuContent>
			</DropdownMenu>
		{/if}
	</div>
{/if}
