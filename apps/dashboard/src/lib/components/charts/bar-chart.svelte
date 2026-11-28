<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const BAR_TOKEN = 'var(--chart-primary)';
const HIGHLIGHT_TOKEN = 'var(--chart-highlight)';
const AXIS_TOKEN = 'var(--text-subtle)';
const GRID_TOKEN = 'var(--chart-axis)';
const PALETTE_KEYS = ['bar', 'highlight', 'axis', 'grid'] as const;
</script>

<script lang="ts">
import type { ClassValue } from 'svelte/elements';
import {
	type BarChartPalette,
	type BarChartPoint,
	buildBarChartOption,
} from './bar-chart-option.ts';
import { resolveChartPalette } from './chart-config.ts';
import ChartGhostGrid from './chart-ghost-grid.svelte';
import { CHART_HEIGHT_PX } from './chart-layout.ts';
import EChart from './echart.svelte';

interface BarChartProps {
	data: readonly BarChartPoint[];
	highlightIndex?: number | null;
	loading?: boolean;
	label: string;
	xFormat?: (label: string, index: number) => string;
	yFormat?: (value: number) => string;
	onHover?: (point: BarChartPoint | null, index: number | null) => void;
	class?: ClassValue;
}

let {
	data,
	highlightIndex = null,
	loading = false,
	label,
	xFormat,
	yFormat,
	onHover,
	class: className,
}: BarChartProps = $props();

let palette = $state.raw<BarChartPalette>();
let hoverIndex = $state<number | null>(null);

const option = $derived(
	palette &&
		buildBarChartOption({
			data,
			palette,
			highlightIndex,
			hoverIndex,
			xFormat,
			yFormat,
		})
);

function resolvePalette(node: HTMLDivElement): void {
	const resolved = resolveChartPalette(
		node,
		{
			bar: { label: 'bar', color: BAR_TOKEN },
			highlight: { label: 'highlight', color: HIGHLIGHT_TOKEN },
			axis: { label: 'axis', color: AXIS_TOKEN },
			grid: { label: 'grid', color: GRID_TOKEN },
		},
		PALETTE_KEYS
	);
	palette = {
		bar: resolved.series.get('bar') ?? '',
		highlight: resolved.series.get('highlight') ?? '',
		axis: resolved.series.get('axis') ?? '',
		grid: resolved.series.get('grid') ?? '',
	};
}

function handleHover(index: number | null): void {
	hoverIndex = index;
	onHover?.(index === null ? null : (data[index] ?? null), index);
}
</script>

<div
	{@attach resolvePalette}
	role="img"
	aria-label={label}
	class={['relative w-full', className]}
	style:height={`${CHART_HEIGHT_PX}px`}
>
	{#if loading}
		<ChartGhostGrid />
	{:else if option}
		<EChart {option} onHoverIndex={handleHover} class="h-full w-full" />
	{/if}
</div>
