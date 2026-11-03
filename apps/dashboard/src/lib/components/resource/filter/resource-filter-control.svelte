<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ListFilter from '@lucide/svelte/icons/list-filter';
import {
	MENU_OFFSET_PX,
	type ResourceFilterConfig,
	type ResourceMenuControlProps,
} from '#lib/components/resource/resource-options.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Popover from '#lib/components/ui/popover/popover.svelte';
import PopoverContent from '#lib/components/ui/popover/popover-content.svelte';
import PopoverTrigger from '#lib/components/ui/popover/popover-trigger.svelte';

let {
	filter,
	onOpenChange,
	open,
}: ResourceMenuControlProps & { filter: ResourceFilterConfig } = $props();

function handleFocusOutside(): void {
	onOpenChange(false);
}
</script>

{#if 'sidebarId' in filter}
	<Chip
		active={filter.open}
		leftIcon={ListFilter}
		aria-controls={filter.sidebarId}
		aria-expanded={filter.open}
		onclick={filter.onToggle}
	>
		Filter
	</Chip>
{:else}
	<Popover {open} {onOpenChange}>
		<PopoverTrigger>
			{#snippet child({
				props,
			})}
				<Chip {...props} active={filter.active} leftIcon={ListFilter}>
					Filter
				</Chip>
			{/snippet}
		</PopoverTrigger>
		<PopoverContent
			align="end"
			alignOffset={MENU_OFFSET_PX}
			strategy="fixed"
			trapFocus={false}
			onFocusOutside={handleFocusOutside}
			class="max-h-none w-fit min-w-0 overflow-visible p-0"
		>
			{@render filter.content()}
		</PopoverContent>
	</Popover>
{/if}
