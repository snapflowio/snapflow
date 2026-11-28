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
import IconButton from '#lib/components/ui/icon-button.svelte';
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

<Popover {open} {onOpenChange}>
	<PopoverTrigger>
		{#snippet child({ props })}
			<IconButton
				{...props}
				size="md"
				label="Filter"
				icon={ListFilter}
				class={[
					'shrink-0',
					filter.active && 'bg-surface-5 text-(--text-primary)',
				]}
			/>
		{/snippet}
	</PopoverTrigger>
	<PopoverContent
		mobileSheet
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
