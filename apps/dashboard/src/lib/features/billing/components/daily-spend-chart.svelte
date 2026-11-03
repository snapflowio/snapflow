<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { ChartConfig } from '#lib/components/charts/chart-config.ts';
import type { LineChartSeries } from '#lib/components/charts/line-chart-types.ts';

type DailySpendSeriesKey = 'compute' | 'network';

const LINE_STROKE_WIDTH = 1.7;
const VALUE_TICK_COUNT = 3;

const DAILY_SPEND_CHART_CONFIG = {
	compute: { label: 'Compute', color: 'var(--brand-accent)' },
	network: { label: 'Network', color: 'var(--brand-secondary)' },
} satisfies ChartConfig<DailySpendSeriesKey>;

const COMPUTE_SERIES: LineChartSeries<DailySpendSeriesKey> = {
	key: 'compute',
	stroke: 'solid',
	strokeWidth: LINE_STROKE_WIDTH,
};
const NETWORK_SERIES: LineChartSeries<DailySpendSeriesKey> = {
	key: 'network',
	stroke: 'dashed',
	strokeWidth: LINE_STROKE_WIDTH,
};
</script>

<script lang="ts">
import type { BillingOverviewDto } from '@snapflow/api-client';
import LineChart from '#lib/components/charts/line-chart.svelte';
import {
	dailySpendPoints,
	formatSpendDay,
	formatSpendTick,
	formatSpendValue,
	hasNetworkSpend,
} from '#lib/features/billing/lib/daily-spend.ts';

interface DailySpendChartProps {
	overview: BillingOverviewDto;
}

let { overview }: DailySpendChartProps = $props();

const titleId = $props.id();
const observedAt = $derived(new Date(overview.observedAt));
const points = $derived(dailySpendPoints(overview.daily, observedAt));
const showNetwork = $derived(hasNetworkSpend(points));
const series = $derived(
	showNetwork ? [COMPUTE_SERIES, NETWORK_SERIES] : [COMPUTE_SERIES]
);
</script>

<section
	aria-labelledby={titleId}
	class="flex flex-col overflow-hidden rounded-md bg-surface-2"
>
	<div
		class="flex min-w-0 items-center justify-between gap-2 bg-surface-3 px-4 py-2.25"
	>
		<h2 id={titleId} class="min-w-0 text-(--text-primary) text-sm">
			Daily spend
		</h2>
	</div>
	<div class="flex-1 rounded-t-md bg-surface-1 px-3.5 py-2.5">
		<LineChart
			data={points}
			xKey="date"
			{series}
			config={DAILY_SPEND_CHART_CONFIG}
			xAxis={{ format: formatSpendDay }}
			yAxis={{ format: formatSpendTick, tickCount: VALUE_TICK_COUNT }}
			tooltip={{ labelFormat: formatSpendDay, valueFormat: formatSpendValue }}
			legend={showNetwork}
			class="h-41.5 w-full"
		/>
	</div>
</section>
