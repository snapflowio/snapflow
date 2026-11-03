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

interface AdminTableContextMenuProps {
	rowActions: (rowId: string) => readonly ResourceRowAction[];
	emptyActions?: readonly ResourceRowAction[];
	children: Snippet;
}

const ROW_SELECTOR = '[data-resource-row]';
const ROW_ID_ATTRIBUTE = 'data-row-id';
</script>

<script lang="ts">
import ResourceRowActionItems from '#lib/components/resource/resource-row-action-items.svelte';
import ContextMenu from '#lib/components/ui/context-menu/context-menu.svelte';
import ContextMenuContent from '#lib/components/ui/context-menu/context-menu-content.svelte';
import ContextMenuTrigger from '#lib/components/ui/context-menu/context-menu-trigger.svelte';

let {
	rowActions,
	emptyActions = [],
	children,
}: AdminTableContextMenuProps = $props();

let open = $state(false);
let targetRowId = $state<string | null>(null);

const actions = $derived(
	(targetRowId === null ? emptyActions : rowActions(targetRowId)).filter(
		(action) => action.visible !== false
	)
);

function captureTarget(event: MouseEvent): void {
	const row =
		event.target instanceof Element ? event.target.closest(ROW_SELECTOR) : null;
	targetRowId = row?.getAttribute(ROW_ID_ATTRIBUTE) ?? null;
}
</script>

<ContextMenu bind:open>
	<ContextMenuTrigger disabled={actions.length === 0}>
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
	<ContextMenuContent onCloseAutoFocus={(event) => event.preventDefault()}>
		<ResourceRowActionItems {actions} />
	</ContextMenuContent>
</ContextMenu>
