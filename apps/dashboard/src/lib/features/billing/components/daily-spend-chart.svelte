<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const DAILY_SPEND_LABEL = 'Daily spend';
const MONTH_TO_DATE_LABEL = 'Month to date';
const MONTH_LABEL_FORMAT: Intl.DateTimeFormatOptions = {
	month: 'long',
	year: 'numeric',
	timeZone: 'UTC',
};
</script>

<script lang="ts">
import type { BillingOverviewDto } from '@snapflow/api-client';
import BarChart from '#lib/components/charts/bar-chart.svelte';
import type { BarChartPoint } from '#lib/components/charts/bar-chart-option.ts';
import MetricCell from '#lib/components/detail/metric-cell.svelte';
import MetricGroup from '#lib/components/detail/metric-group.svelte';
import Money from '#lib/components/ui/money.svelte';
import {
	dailySpendPoints,
	formatSpendDay,
	formatSpendTick,
	formatSpendValue,
	spendDayIndex,
} from '#lib/features/billing/lib/daily-spend.ts';
import { DISPLAY_LOCALE } from '#lib/utils/format.ts';

interface DailySpendChartProps {
	overview: BillingOverviewDto;
	loading?: boolean;
}

let { overview, loading = false }: DailySpendChartProps = $props();

const observedAt = $derived(new Date(overview.observedAt));
const points = $derived(dailySpendPoints(overview.daily, observedAt));
const data = $derived<BarChartPoint[]>(
	points.map((point) => ({ label: point.date, value: point.total }))
);
const today = $derived(spendDayIndex(points, observedAt));
const monthLabel = $derived(
	observedAt.toLocaleDateString(DISPLAY_LOCALE, MONTH_LABEL_FORMAT)
);
let hovered = $state<BarChartPoint | null>(null);
</script>

<MetricGroup label={DAILY_SPEND_LABEL} columns={1}>
	<MetricCell title={DAILY_SPEND_LABEL} context={MONTH_TO_DATE_LABEL}>
		<span aria-live="polite">
			{#if hovered}
				{formatSpendValue(hovered.value)}
			{:else}
				<Money microUsd={overview.month.actualMicroUsd} />
			{/if}
		</span>
		{#snippet legend()}
			<span class="flex items-center gap-x-2">
				<span
					aria-hidden="true"
					class="h-0.5 w-3 shrink-0 bg-(--chart-primary)"
				></span>
				<span class="text-(--text-subtle)">
					{hovered ? formatSpendDay(hovered.label) : monthLabel}
				</span>
			</span>
		{/snippet}
		{#snippet chart()}
			<BarChart
				{data}
				{loading}
				label={DAILY_SPEND_LABEL}
				highlightIndex={today}
				xFormat={(label) => formatSpendDay(label)}
				yFormat={formatSpendTick}
				onHover={(point) => {
					hovered = point;
				}}
			/>
		{/snippet}
	</MetricCell>
</MetricGroup>
