/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ChartOption } from './echarts.ts';
import { buildLineSeries, DASH_PATTERN } from './line-chart-series.ts';
import { buildLineChartTooltipOption } from './line-chart-tooltip-option.ts';
import type { LineChartOptionInput, LineChartRow } from './line-chart-types.ts';

const GRID_INSET_PX = 8;
const GRID_TOP_PX = 16;
const GRID_TOP_WITH_LEGEND_PX = 42;
const AXIS_LABEL_FONT_SIZE_PX = 10;
const AXIS_LABEL_MARGIN_PX = 8;
const GRID_LINE_WIDTH_PX = 1;
const REVEAL_DURATION_MS = 1000;
const INSTANT_MS = 0;

export function buildLineChartOption<
	TXKey extends string,
	TSeriesKey extends string,
	TRow extends LineChartRow<TXKey, TSeriesKey>,
>(input: LineChartOptionInput<TXKey, TSeriesKey, TRow>): ChartOption {
	const { data, xKey, palette } = input;
	const xFormat = input.xAxis?.format;
	const axisLabel = {
		show: true,
		color: palette.mutedForeground,
		fontSize: AXIS_LABEL_FONT_SIZE_PX,
		margin: AXIS_LABEL_MARGIN_PX,
	};

	return {
		animation: input.animate,
		animationDuration: REVEAL_DURATION_MS,
		animationDurationUpdate: INSTANT_MS,
		grid: {
			left: GRID_INSET_PX,
			right: GRID_INSET_PX,
			top: input.legend ? GRID_TOP_WITH_LEGEND_PX : GRID_TOP_PX,
			bottom: GRID_INSET_PX,
		},
		xAxis: {
			type: 'category',
			boundaryGap: false,
			data: data.map((row) => String(row[xKey])),
			axisLine: { show: false },
			axisTick: { show: false },
			splitLine: { show: false },
			axisLabel: {
				...axisLabel,
				formatter: xFormat
					? (value: string, index: number) => {
							const row = data[index];
							return row ? xFormat(row[xKey], index) : value;
						}
					: undefined,
			},
		},
		yAxis: {
			type: 'value',
			splitNumber: input.yAxis?.tickCount,
			axisLine: { show: false },
			axisTick: { show: false },
			splitLine: {
				show: true,
				lineStyle: {
					color: palette.border,
					type: DASH_PATTERN,
					width: GRID_LINE_WIDTH_PX,
				},
			},
			axisLabel: { ...axisLabel, formatter: input.yAxis?.format },
		},
		tooltip: buildLineChartTooltipOption(input),
		series: buildLineSeries(input),
	};
}
