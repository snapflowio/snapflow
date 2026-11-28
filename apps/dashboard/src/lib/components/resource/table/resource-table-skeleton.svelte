<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const DEFAULT_ROW_COUNT = 8;
const CELL_WIDTHS = ['w-3/5', 'w-2/5', 'w-1/2', 'w-1/3'] as const;

function cellWidth(rowIndex: number, columnIndex: number): string {
	return CELL_WIDTHS[(rowIndex + columnIndex) % CELL_WIDTHS.length] ?? 'w-1/2';
}
</script>

<script lang="ts">
import { DelayedReveal } from '#lib/components/ui/skeleton/delayed-reveal.svelte.ts';
import Skeleton from '#lib/components/ui/skeleton/skeleton.svelte';

interface ResourceTableSkeletonProps {
	gridTemplateColumns: string;
	columnCount: number;
	rowCount?: number;
}

let {
	gridTemplateColumns,
	columnCount,
	rowCount = DEFAULT_ROW_COUNT,
}: ResourceTableSkeletonProps = $props();

const reveal = new DelayedReveal();
const rows = $derived(Array.from({ length: rowCount }, (_, index) => index));
const columns = $derived(
	Array.from({ length: columnCount }, (_, index) => index)
);
</script>

{#if reveal.visible}
	<div aria-hidden="true" class="grid">
		{#each rows as rowIndex (rowIndex)}
			<div
				class="grid w-full"
				style:grid-template-columns={gridTemplateColumns}
			>
				{#each columns as columnIndex (columnIndex)}
					<div
						class="flex min-h-11 items-center px-2 first:pl-4 last:pr-4 md:min-h-(--space-row)"
					>
						<Skeleton
							decorative
							delayMs={0}
							class={['h-3', cellWidth(rowIndex, columnIndex)]}
						/>
					</div>
				{/each}
			</div>
		{/each}
	</div>
{/if}
