<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { Snippet } from 'svelte';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';

interface ResourceRowContextMenuProps {
	actionsFor: (rowId: string | null) => readonly ResourceRowAction[];
	onTarget?: (rowId: string | null) => void;
	children: Snippet;
}

const ROW_SELECTOR = '[data-row-id]';

function targetRowId(target: EventTarget | null): string | null {
	if (!(target instanceof Element)) return null;
	return target.closest<HTMLElement>(ROW_SELECTOR)?.dataset['rowId'] ?? null;
}

function hasVisibleActions(actions: readonly ResourceRowAction[]): boolean {
	return actions.some((action) => action.visible !== false);
}
</script>

<script lang="ts">
import ResourceRowActionItems from '#lib/components/resource/resource-row-action-items.svelte';
import ContextMenu from '#lib/components/ui/context-menu/context-menu.svelte';
import ContextMenuContent from '#lib/components/ui/context-menu/context-menu-content.svelte';
import ContextMenuTrigger from '#lib/components/ui/context-menu/context-menu-trigger.svelte';

let { actionsFor, onTarget, children }: ResourceRowContextMenuProps = $props();

let target = $state<string | null>(null);
const actions = $derived(actionsFor(target));

function captureTarget(event: MouseEvent): void {
	const rowId = targetRowId(event.target);
	if (!hasVisibleActions(actionsFor(rowId))) {
		event.stopPropagation();
		return;
	}
	target = rowId;
	onTarget?.(rowId);
}
</script>

<ContextMenu>
	<ContextMenuTrigger>
		{#snippet child({
			props,
		})}
			<div
				{...props}
				class="flex min-h-0 flex-1 flex-col"
				oncontextmenucapture={captureTarget}
			>
				{@render children()}
			</div>
		{/snippet}
	</ContextMenuTrigger>
	<ContextMenuContent>
		<ResourceRowActionItems {actions} />
	</ContextMenuContent>
</ContextMenu>
