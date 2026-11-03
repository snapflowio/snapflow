<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { SnapshotDto } from '@snapflow/api-client';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';

interface SnapshotDetailsPanelProps {
	snapshot: SnapshotDto | null;
	open: boolean;
	actions: readonly ResourceRowAction[];
	onClose: () => void;
	onPrevious?: () => void;
	onNext?: () => void;
}
</script>

<script lang="ts">
import MoreHorizontal from '@lucide/svelte/icons/ellipsis';
import ResourceDetailsPanel from '#lib/components/resource/resource-details-panel.svelte';
import ResourceRowActionItems from '#lib/components/resource/resource-row-action-items.svelte';
import DropdownMenu from '#lib/components/ui/dropdown-menu/dropdown-menu.svelte';
import DropdownMenuContent from '#lib/components/ui/dropdown-menu/dropdown-menu-content.svelte';
import DropdownMenuTrigger from '#lib/components/ui/dropdown-menu/dropdown-menu-trigger.svelte';
import IconButton from '#lib/components/ui/icon-button.svelte';
import SnapshotDetailsBody from './snapshot-details-body.svelte';

let {
	snapshot,
	open,
	actions,
	onClose,
	onPrevious,
	onNext,
}: SnapshotDetailsPanelProps = $props();

const hasActions = $derived(actions.some((action) => action.visible !== false));
</script>

{#snippet panelActions()}
	{#if hasActions}
		<DropdownMenu>
			<DropdownMenuTrigger>
				{#snippet child({
					props,
				})}
					<IconButton
						{...props}
						variant="ghost"
						label="Snapshot actions"
						icon={MoreHorizontal}
					/>
				{/snippet}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<ResourceRowActionItems {actions} />
			</DropdownMenuContent>
		</DropdownMenu>
	{/if}
{/snippet}

<ResourceDetailsPanel
	{open}
	title={snapshot?.name ?? 'Snapshot details'}
	{onClose}
	{onPrevious}
	{onNext}
	actions={panelActions}
>
	{#if snapshot}
		<SnapshotDetailsBody {snapshot} />
	{/if}
</ResourceDetailsPanel>
