<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script
	lang="ts"
	generics="TXKey extends string, TSeriesKey extends string, TRow extends LineChartRow<TXKey, TSeriesKey>"
>
import type { ClassValue } from 'svelte/elements';
import { MediaQuery } from 'svelte/reactivity';
import {
	type ChartConfig,
	type ChartPalette,
	resolveChartPalette,
} from './chart-config.ts';
import ChartLegend from './chart-legend.svelte';
import EChart from './echart.svelte';
import { buildLineChartOption } from './line-chart-option.ts';
import type {
	// biome-ignore lint/correctness/noUnusedImports: used by the generics attribute, which Biome does not read
	LineChartRow,
	LineChartSeries,
	LineChartTooltip,
	LineChartXAxis,
	LineChartYAxis,
} from './line-chart-types.ts';

interface LineChartProps {
	data: readonly TRow[];
	xKey: TXKey;
	series: readonly LineChartSeries<TSeriesKey>[];
	config: ChartConfig<NoInfer<TSeriesKey>>;
	xAxis?: LineChartXAxis<TRow[TXKey]>;
	yAxis?: LineChartYAxis;
	tooltip?: LineChartTooltip<TRow[TXKey]>;
	legend?: boolean;
	class?: ClassValue;
}

let {
	data,
	xKey,
	series,
	config,
	xAxis,
	yAxis,
	tooltip,
	legend = false,
	class: className,
}: LineChartProps = $props();

const reducedMotion = new MediaQuery('prefers-reduced-motion: reduce');
const seriesKeys = $derived(series.map((line) => line.key));
let palette = $state.raw<ChartPalette<TSeriesKey>>();

const option = $derived(
	palette &&
		buildLineChartOption({
			data,
			xKey,
			series,
			config,
			palette,
			xAxis,
			yAxis,
			tooltip,
			legend,
			animate: !reducedMotion.current,
		})
);

const legendItems = $derived(
	series.map((line) => ({
		key: line.key,
		label: config[line.key].label,
		color: palette?.series.get(line.key) ?? '',
	}))
);

function resolvePalette(node: HTMLDivElement) {
	palette = resolveChartPalette(node, config, seriesKeys);
}
</script>

<div
	{@attach resolvePalette}
	class={['relative flex flex-col text-xs', className]}
>
	<div class="relative min-h-0 w-full flex-1">
		{#if option}
			<EChart {option} class="h-full min-h-0 w-full" />
		{/if}
	</div>

	{#if legend && palette}
		<ChartLegend items={legendItems} />
	{/if}
</div>
