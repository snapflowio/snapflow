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

export interface ResourceBulkAction {
	id: string;
	label: string;
	icon: IconComponent;
	onSelect: (ids: string[]) => void;
	disabled?: boolean;
	destructive?: boolean;
}
</script>

<script lang="ts">
import IconButton from '#lib/components/ui/icon-button.svelte';
import Tooltip from '#lib/components/ui/tooltip/tooltip.svelte';

interface ResourceBulkActionBarProps {
	selectedIds: readonly string[];
	actions: readonly ResourceBulkAction[];
}

let { selectedIds, actions }: ResourceBulkActionBarProps = $props();

const orderedActions = $derived([
	...actions.filter((action) => !action.destructive),
	...actions.filter((action) => action.destructive),
]);
</script>

{#if selectedIds.length > 0}
	<div
		role="toolbar"
		aria-label="Selection actions"
		class="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 z-(--z-dropdown) max-w-[calc(100%-2rem)] -translate-x-1/2 animate-in fade-in-0 slide-in-from-bottom-2 duration-200 ease-out motion-reduce:animate-none md:max-w-none"
	>
		<div
			class="flex items-center justify-between gap-2 rounded-[10px] border border-border bg-surface-2 px-2 py-1.5"
		>
			<span
				class="min-w-0 whitespace-nowrap px-1 text-(--text-secondary) text-small tabular-nums"
			>
				{selectedIds.length}
				selected
			</span>
			<div class="flex items-center gap-1.25">
				{#each orderedActions as action (action.id)}
					<Tooltip content={action.label} preferAbove>
						{#snippet child({
							props,
						})}
							<IconButton
								{...props}
								variant={action.destructive ? 'bulk-destructive' : 'bulk'}
								label={action.label}
								icon={action.icon}
								disabled={action.disabled}
								onclick={() => action.onSelect([...selectedIds])}
							/>
						{/snippet}
					</Tooltip>
				{/each}
			</div>
		</div>
	</div>
{/if}
