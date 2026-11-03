<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" generics="TData extends RowData">
import {
	type Cell,
	FlexRender,
	// biome-ignore lint/correctness/noUnusedImports: used by the generics attribute, which Biome does not read
	type RowData,
} from '@tanstack/svelte-table';
import Checkbox from '#lib/components/ui/checkbox/checkbox.svelte';
import {
	resourceCellClass,
	resourceCellPaddingClass,
} from './resource-table.ts';
import {
	type ResourceTableFeatures,
	resourceColumnLayout,
} from './resource-table-model.ts';

interface ResourceTableCellProps {
	cell: Cell<ResourceTableFeatures, TData>;
	label: string;
}

let { cell, label }: ResourceTableCellProps = $props();

const layout = $derived(resourceColumnLayout(cell.column));
</script>

{#if layout.variant === 'selection'}
	<td class="flex items-center justify-center px-3 py-2.5">
		<Checkbox
			size="sm"
			aria-label={`Select ${label}`}
			checked={cell.row.getIsSelected()}
			disabled={!cell.row.getCanSelect()}
			onCheckedChange={(checked) => cell.row.toggleSelected(Boolean(checked))}
		/>
	</td>
{:else}
	<td class={[resourceCellClass, resourceCellPaddingClass(layout)]}>
		<FlexRender {cell} />
	</td>
{/if}
