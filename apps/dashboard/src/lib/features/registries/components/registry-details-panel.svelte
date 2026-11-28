<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import MoreHorizontal from '@lucide/svelte/icons/ellipsis';
import type { DockerRegistry } from '@snapflow/api-client';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import ResourceDetailsPanel from '#lib/components/resource/resource-details-panel.svelte';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import ResourceRowActionItems from '#lib/components/resource/resource-row-action-items.svelte';
import DropdownMenu from '#lib/components/ui/dropdown-menu/dropdown-menu.svelte';
import DropdownMenuContent from '#lib/components/ui/dropdown-menu/dropdown-menu-content.svelte';
import DropdownMenuTrigger from '#lib/components/ui/dropdown-menu/dropdown-menu-trigger.svelte';
import IconButton from '#lib/components/ui/icon-button.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import { registryTypeLabel } from '#lib/features/registries/lib/registries-list.ts';

interface RegistryDetailsPanelProps {
	registry: DockerRegistry | null;
	open: boolean;
	actions: readonly ResourceRowAction[];
	onClose: () => void;
	onPrevious?: () => void;
	onNext?: () => void;
}

let {
	registry,
	open,
	actions,
	onClose,
	onPrevious,
	onNext,
}: RegistryDetailsPanelProps = $props();

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
						label="Registry actions"
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
	title={registry?.name ?? 'Registry details'}
	resourceId={registry?.id}
	resourceIdLabel="Copy registry ID"
	{onClose}
	{onPrevious}
	{onNext}
	actions={panelActions}
>
	{#if registry}
		<KeyValueList framed={false} label="Registry details">
			<KeyValueRow
				label="URL"
				value={registry.url}
				mono
				copy={registry.url}
				copyLabel="Copy URL"
			/>
			<KeyValueRow
				label="Username"
				value={registry.username}
				mono
				copy={registry.username}
				copyLabel="Copy username"
			/>
			<KeyValueRow label="Project" value={registry.project} mono />
			<KeyValueRow
				label="Type"
				value={registryTypeLabel(registry.registryType)}
			/>
			<KeyValueRow label="Created">
				<Timestamp value={registry.createdAt} />
			</KeyValueRow>
			<KeyValueRow label="Updated">
				<Timestamp value={registry.updatedAt} />
			</KeyValueRow>
		</KeyValueList>
	{/if}
</ResourceDetailsPanel>
