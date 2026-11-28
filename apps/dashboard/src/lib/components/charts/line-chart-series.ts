/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { LineSeriesOption } from 'echarts/charts';
import type { ChartPalette } from './chart-config.ts';
import type {
	LineChartOptionInput,
	LineChartRow,
	LineChartSeries,
} from './line-chart-types.ts';

const DASH_PX = 3;
const COMPARISON_DASH_PX = 5;
const COMPARISON_GAP_PX = 4;
const COMPARISON_DASH: [number, number] = [
	COMPARISON_DASH_PX,
	COMPARISON_GAP_PX,
];
export const LINE_STROKE_WIDTH_PX = 1.5;
const AREA_TOP_OPACITY = 0.16;
const AREA_BOTTOM_OPACITY = 0;
const ACTIVE_DOT_SIZE_PX = 6;
const ACTIVE_DOT_BORDER_WIDTH_PX = 1;
const ACTIVE_DOT_EMPHASIS_SCALE = 1;
const SERIES_Z = 2;
const UNRESOLVED_COLOR = 'rgba(120, 120, 120, 1)';

export const DASH_PATTERN: [number, number] = [DASH_PX, DASH_PX];

function lineType<TSeriesKey extends string>(
	line: LineChartSeries<TSeriesKey>
): 'solid' | [number, number] {
	if (line.comparison) return COMPARISON_DASH;
	return line.stroke === 'solid' ? 'solid' : DASH_PATTERN;
}

function withOpacity(color: string, opacity: number): string {
	const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
	if (!match) return color;
	return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${opacity})`;
}

export function seriesColor<TSeriesKey extends string>(
	palette: ChartPalette<TSeriesKey>,
	key: TSeriesKey
): string {
	return palette.series.get(key) ?? UNRESOLVED_COLOR;
}

export function buildLineSeries<
	TXKey extends string,
	TSeriesKey extends string,
	TRow extends LineChartRow<TXKey, TSeriesKey>,
>(input: LineChartOptionInput<TXKey, TSeriesKey, TRow>): LineSeriesOption[] {
	const { data, config, palette } = input;
	return input.series.map((line): LineSeriesOption => {
		const color = line.comparison
			? palette.previous
			: seriesColor(palette, line.key);
		const activeDot = {
			color: palette.background,
			borderColor: color,
			borderWidth: ACTIVE_DOT_BORDER_WIDTH_PX,
		};
		return {
			id: line.key,
			name: config[line.key].label,
			type: 'line',
			data: data.map((row) => row[line.key] ?? 0),
			smooth: false,
			step: false,
			connectNulls: false,
			cursor: 'default',
			showSymbol: false,
			symbol: 'circle',
			symbolSize: ACTIVE_DOT_SIZE_PX,
			z: SERIES_Z,
			lineStyle: {
				color,
				width: line.strokeWidth ?? LINE_STROKE_WIDTH_PX,
				type: lineType(line),
			},
			areaStyle:
				line.area && !line.comparison
					? {
							color: {
								type: 'linear',
								x: 0,
								y: 0,
								x2: 0,
								y2: 1,
								colorStops: [
									{ offset: 0, color: withOpacity(color, AREA_TOP_OPACITY) },
									{
										offset: 1,
										color: withOpacity(color, AREA_BOTTOM_OPACITY),
									},
								],
							},
						}
					: undefined,
			itemStyle: activeDot,
			emphasis: {
				focus: 'none',
				scale: ACTIVE_DOT_EMPHASIS_SCALE,
				itemStyle: activeDot,
			},
		};
	});
}
