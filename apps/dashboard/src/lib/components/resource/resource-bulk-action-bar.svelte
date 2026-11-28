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
	onSelect: (ids: string[]) => unknown;
	disabled?: boolean;
	disabledReason?: string;
	destructive?: boolean;
	shortcut?: string | readonly string[];
}
</script>

<script lang="ts">
import X from '@lucide/svelte/icons/x';
import Chip from '#lib/components/ui/chip/chip.svelte';
import IconButton from '#lib/components/ui/icon-button.svelte';
import Tooltip from '#lib/components/ui/tooltip/tooltip.svelte';

interface ResourceBulkActionBarProps {
	selectedIds: readonly string[];
	actions: readonly ResourceBulkAction[];
	onClear?: () => void;
	onPartialFailure?: (failedIds: string[]) => void;
}

let {
	selectedIds,
	actions,
	onClear,
	onPartialFailure,
}: ResourceBulkActionBarProps = $props();

let runningId = $state<string | null>(null);

function isFailedIds(result: unknown): result is readonly string[] {
	return Array.isArray(result) && result.every((id) => typeof id === 'string');
}

const orderedActions = $derived([
	...actions.filter((action) => !action.destructive),
	...actions.filter((action) => action.destructive),
]);

async function run(action: ResourceBulkAction): Promise<void> {
	runningId = action.id;
	try {
		const result = await action.onSelect([...selectedIds]);
		if (isFailedIds(result) && result.length > 0) {
			onPartialFailure?.([...result]);
		}
	} finally {
		runningId = null;
	}
}
</script>

{#if selectedIds.length > 0}
	<div
		role="toolbar"
		aria-label="Selection actions"
		class="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 z-(--z-dropdown) max-w-[calc(100%-2rem)] -translate-x-1/2 animate-in fade-in-0 slide-in-from-bottom-2 duration-(--motion-emphasis) ease-(--ease-enter) motion-reduce:animate-none md:max-w-none"
	>
		<div
			class="flex items-center gap-3 rounded-full border border-border bg-surface-1 p-1.5 shadow-(--shadow-overlay)"
		>
			{#if onClear}
				<IconButton
					label="Clear selection"
					shortcut="esc"
					icon={X}
					preferAbove
					onclick={onClear}
				/>
			{/if}
			<span
				class="min-w-0 whitespace-nowrap text-(--text-muted) text-sm tabular-nums"
			>
				<strong class="font-medium text-(--text-primary)"
					>{selectedIds.length}</strong
				>
				selected
			</span>
			<div class="flex items-center gap-2">
				{#each orderedActions as action (action.id)}
					<Tooltip
						content={action.label}
						shortcut={action.shortcut}
						preferAbove
						disabled={Boolean(action.disabledReason)}
					>
						{#snippet child({ props })}
							<Chip
								{...props}
								size="compact"
								variant={action.destructive ? 'destructive' : 'secondary'}
								leftIcon={action.icon}
								loading={runningId === action.id}
								disabled={action.disabled}
								disabledReason={action.disabled
									? action.disabledReason
									: undefined}
								onclick={() => void run(action)}
							>
								{action.label}
							</Chip>
						{/snippet}
					</Tooltip>
				{/each}
			</div>
		</div>
	</div>
{/if}
