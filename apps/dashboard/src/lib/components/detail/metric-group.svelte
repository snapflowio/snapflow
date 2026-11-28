<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
export type MetricGroupColumns = 1 | 2 | 3;

const COLUMNS_CLASS: Record<MetricGroupColumns, string> = {
	1: '',
	2: '@md/metrics:grid-cols-2',
	3: '@md/metrics:grid-cols-2 @3xl/metrics:grid-cols-3',
};
const PAIRED_MAXIMUM = 4;
const SINGLE_COLUMN = 1;
const PAIRED_COLUMNS = 2;
const TRIPLE_COLUMNS = 3;

export function metricColumns(count: number): MetricGroupColumns {
	if (count <= SINGLE_COLUMN) return SINGLE_COLUMN;
	return count % PAIRED_COLUMNS === 0 && count <= PAIRED_MAXIMUM
		? PAIRED_COLUMNS
		: TRIPLE_COLUMNS;
}
</script>

<script lang="ts">
import type { Snippet } from 'svelte';
import { cn } from '#lib/utils/utils.ts';

interface MetricGroupProps {
	label?: string;
	columns?: MetricGroupColumns;
	children: Snippet;
}

let { label, columns = 2, children }: MetricGroupProps = $props();
</script>

<section
	aria-label={label}
	class="@container/metrics flex flex-col overflow-hidden rounded-2xl border border-border"
>
	<div
		class={cn(
			'grid grid-cols-1 [clip-path:inset(1px_1px_1px_1px)] [&>*]:border-border [&>*]:border-r [&>*]:border-b',
			COLUMNS_CLASS[columns]
		)}
	>
		{@render children()}
	</div>
</section>
