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
import type { ResourceCreateAction } from './resource-header.svelte';
import type { ResourceFilterTag } from './resource-options.ts';

interface ResourceListEmptyProps {
	message: string;
	description?: string;
	icon?: IconComponent;
	search: string;
	filterCount?: number;
	filters?: readonly ResourceFilterTag[];
	resource?: string;
	onClear: () => void;
	create?: ResourceCreateAction;
}
</script>

<script lang="ts">
import Plus from '@lucide/svelte/icons/plus';
import EmptyState from '#lib/components/empty-state.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ResourceNoResults from './resource-no-results.svelte';

let {
	message,
	description,
	icon,
	search,
	filterCount = 0,
	filters = [],
	resource,
	onClear,
	create,
}: ResourceListEmptyProps = $props();

const narrowed = $derived(search.trim().length > 0 || filterCount > 0);
</script>

{#snippet createAction(action: ResourceCreateAction)}
	<Chip
		variant="secondary"
		size="compact"
		leftIcon={Plus}
		disabled={action.disabled}
		disabledReason={action.disabled ? action.disabledReason : undefined}
		onclick={action.onSelect}
	>
		{action.label}
	</Chip>
{/snippet}

{#snippet createActions()}
	{#if create}
		{@render createAction(create)}
	{/if}
{/snippet}

{#if narrowed}
	<ResourceNoResults {search} {filterCount} {filters} {resource} {onClear} />
{:else}
	<EmptyState
		{icon}
		bordered={false}
		title={message}
		actions={create ? createActions : undefined}
	>
		{#if description}
			<p>{description}</p>
		{/if}
	</EmptyState>
{/if}
