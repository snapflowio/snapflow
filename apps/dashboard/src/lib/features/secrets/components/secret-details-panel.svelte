<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const MASKED_VALUE = '••••••••';
const MASKED_VALUE_INFO = "Secret values can't be shown again";
</script>

<script lang="ts">
import MoreHorizontal from '@lucide/svelte/icons/ellipsis';
import EyeOff from '@lucide/svelte/icons/eye-off';
import type { SecretDto } from '@snapflow/api-client';
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
import Tooltip from '#lib/components/ui/tooltip/tooltip.svelte';

interface SecretDetailsPanelProps {
	secret: SecretDto | null;
	open: boolean;
	actions: readonly ResourceRowAction[];
	onClose: () => void;
	onPrevious?: () => void;
	onNext?: () => void;
}

let {
	secret,
	open,
	actions,
	onClose,
	onPrevious,
	onNext,
}: SecretDetailsPanelProps = $props();

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
						label="Secret actions"
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
	title={secret?.name ?? 'Secret details'}
	resourceId={secret?.id}
	resourceIdLabel="Copy secret ID"
	{onClose}
	{onPrevious}
	{onNext}
	actions={panelActions}
>
	{#if secret}
		<KeyValueList framed={false} label="Secret details">
			<KeyValueRow
				label="Name"
				value={secret.name}
				mono
				copy={secret.name}
				copyLabel="Copy name"
			/>
			<KeyValueRow label="Version" value={`v${secret.currentVersion}`} mono />
			<KeyValueRow label="Value">
				<span class="inline-flex items-center gap-1.5">
					<span class="font-mono text-(--text-muted)">{MASKED_VALUE}</span>
					<Tooltip content={MASKED_VALUE_INFO}>
						{#snippet child({ props })}
							<span
								{...props}
								role="img"
								aria-label={MASKED_VALUE_INFO}
								class="inline-flex text-(--text-icon)"
							>
								<EyeOff class="size-3.5" />
							</span>
						{/snippet}
					</Tooltip>
				</span>
			</KeyValueRow>
			<KeyValueRow label="Description" value={secret.description} />
			<KeyValueRow label="Updated">
				<Timestamp value={secret.updatedAt} />
			</KeyValueRow>
			<KeyValueRow label="Created">
				<Timestamp value={secret.createdAt} />
			</KeyValueRow>
		</KeyValueList>
	{/if}
</ResourceDetailsPanel>
