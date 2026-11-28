<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { VolumeBackupState, type VolumeDto } from '@snapflow/api-client';
import type {
	StatusRingShape,
	StatusRingTone,
} from '#lib/components/ui/status/status-ring.svelte';

interface VolumeDetailsPanelProps {
	volume: VolumeDto | null;
	open: boolean;
	actions: readonly ResourceRowAction[];
	onClose: () => void;
	onPrevious?: () => void;
	onNext?: () => void;
}

const BACKUP_STATUS: Record<
	VolumeBackupState,
	{ label: string; shape: StatusRingShape; tone: StatusRingTone }
> = {
	[VolumeBackupState.None]: { label: 'None', shape: 'empty', tone: 'neutral' },
	[VolumeBackupState.Pending]: {
		label: 'Pending',
		shape: 'dashed',
		tone: 'neutral',
	},
	[VolumeBackupState.Completed]: {
		label: 'Completed',
		shape: 'check',
		tone: 'success',
	},
	[VolumeBackupState.Error]: { label: 'Error', shape: 'cross', tone: 'error' },
};
</script>

<script lang="ts">
import MoreHorizontal from '@lucide/svelte/icons/ellipsis';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import ResourceDetailsPanel from '#lib/components/resource/resource-details-panel.svelte';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import ResourceRowActionItems from '#lib/components/resource/resource-row-action-items.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import DropdownMenu from '#lib/components/ui/dropdown-menu/dropdown-menu.svelte';
import DropdownMenuContent from '#lib/components/ui/dropdown-menu/dropdown-menu-content.svelte';
import DropdownMenuTrigger from '#lib/components/ui/dropdown-menu/dropdown-menu-trigger.svelte';
import IconButton from '#lib/components/ui/icon-button.svelte';
import StatusLabel from '#lib/components/ui/status/status-label.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';

let {
	volume,
	open,
	actions,
	onClose,
	onPrevious,
	onNext,
}: VolumeDetailsPanelProps = $props();

const hasActions = $derived(actions.some((action) => action.visible !== false));
</script>

{#snippet panelActions()}
	{#if hasActions}
		<DropdownMenu>
			<DropdownMenuTrigger>
				{#snippet child({ props })}
					<IconButton
						{...props}
						variant="ghost"
						label="Volume actions"
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
	title={volume?.name ?? 'Volume details'}
	resourceId={volume?.id}
	resourceIdLabel="Copy volume ID"
	{onClose}
	{onPrevious}
	{onNext}
	actions={panelActions}
>
	{#if volume}
		{const backup = $derived(BACKUP_STATUS[volume.backupState])}
		<KeyValueList framed={false} label="Volume details">
			<KeyValueRow label="State">
				<ResourceStateBadge
					errorReason={volume.errorReason}
					state={volume.state}
				/>
			</KeyValueRow>
			<KeyValueRow label="Size" value={`${volume.sizeGiB} GiB`} />
			<KeyValueRow label="Filesystem" value={volume.filesystem} mono />
			<KeyValueRow label="Created">
				<Timestamp value={volume.createdAt} />
			</KeyValueRow>
			<KeyValueRow label="Last used">
				{#if volume.lastUsedAt}
					<Timestamp value={volume.lastUsedAt} />
				{:else}
					<span class="text-(--text-muted)">Never</span>
				{/if}
			</KeyValueRow>
			<KeyValueRow label="Backup">
				<StatusLabel
					shape={backup.shape}
					tone={backup.tone}
					label={backup.label}
				/>
			</KeyValueRow>
			<KeyValueRow label="Last backup">
				{#if volume.lastBackupAt}
					<Timestamp value={volume.lastBackupAt} />
				{:else}
					<span class="text-(--text-muted)">Never</span>
				{/if}
			</KeyValueRow>
		</KeyValueList>
	{/if}
</ResourceDetailsPanel>
