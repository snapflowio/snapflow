<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" generics="TData extends RowData">
import { type Cell, FlexRender, type RowData } from '@tanstack/svelte-table';
import Checkbox from '#lib/components/ui/checkbox/checkbox.svelte';
import {
	RESOURCE_TABLE_VARIANT,
	type ResourceTableVariant,
	resourceCellPaddingClass,
} from './resource-table.ts';
import {
	type ResourceTableFeatures,
	resourceColumnLayout,
} from './resource-table-model.ts';

interface ResourceTableCellProps {
	cell: Cell<ResourceTableFeatures, TData>;
	label: string;
	variant: ResourceTableVariant;
}

let { cell, label, variant }: ResourceTableCellProps = $props();

const layout = $derived(resourceColumnLayout(cell.column));
</script>

{#if layout.variant === 'selection'}
	<td class="flex items-center justify-center py-2 pl-4">
		<Checkbox
			size="sm"
			aria-label={`Select ${label}`}
			checked={cell.row.getIsSelected()}
			disabled={!cell.row.getCanSelect()}
			onCheckedChange={(checked) => cell.row.toggleSelected(Boolean(checked))}
		/>
	</td>
{:else}
	<td
		class={[
			RESOURCE_TABLE_VARIANT[variant].cell,
			resourceCellPaddingClass(layout, variant),
		]}
	>
		<FlexRender {cell} />
	</td>
{/if}
