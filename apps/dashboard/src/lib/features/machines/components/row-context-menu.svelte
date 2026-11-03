<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { Snippet } from 'svelte';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import ResourceRowActionItems from '#lib/components/resource/resource-row-action-items.svelte';
import ContextMenu from '#lib/components/ui/context-menu/context-menu.svelte';
import ContextMenuContent from '#lib/components/ui/context-menu/context-menu-content.svelte';
import ContextMenuTrigger from '#lib/components/ui/context-menu/context-menu-trigger.svelte';

interface RowContextMenuProps {
	actions: readonly ResourceRowAction[];
	onTrigger?: () => void;
	children: Snippet;
}

let { actions, onTrigger, children }: RowContextMenuProps = $props();

let open = $state(false);
const hasActions = $derived(actions.some((action) => action.visible !== false));
</script>

<ContextMenu bind:open>
	<ContextMenuTrigger
		class="flex min-h-0 min-w-0 flex-1 flex-col"
		oncontextmenucapture={() => onTrigger?.()}
	>
		{@render children()}
	</ContextMenuTrigger>
	{#if hasActions}
		<ContextMenuContent>
			<ResourceRowActionItems {actions} />
		</ContextMenuContent>
	{/if}
</ContextMenu>
