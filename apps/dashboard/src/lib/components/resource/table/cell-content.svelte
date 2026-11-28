<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" generics="TData">
import {
	cellIconNodeClass,
	chipContentGap,
} from '#lib/components/ui/chip/chip-chrome.ts';
import OverflowText from '#lib/components/ui/overflow/overflow-text.svelte';
import { EMPTY_CELL_PLACEHOLDER, type ResourceCell } from './resource-table.ts';

interface CellContentProps {
	cell: ResourceCell<TData>;
	data: TData;
}

let { cell, data }: CellContentProps = $props();
</script>

{#if cell.content}
	{@render cell.content(data)}
{:else}
	<span class={['flex min-w-0 items-center', chipContentGap]}>
		{#if cell.icon}
			<span class={cellIconNodeClass}>{@render cell.icon(data)}</span>
		{/if}
		<span class="flex min-w-0 items-baseline gap-1.5">
			<OverflowText
				text={cell.label || EMPTY_CELL_PLACEHOLDER}
				class="text-current"
			/>
			{#if cell.sublabel}
				<span class="min-w-0 truncate text-(--text-muted) text-xs">
					{cell.sublabel}
				</span>
			{/if}
		</span>
	</span>
{/if}
