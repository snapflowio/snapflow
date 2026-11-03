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
import type { LineChartOptionInput, LineChartRow } from './line-chart-types.ts';

const DASH_PX = 3;
const ACTIVE_DOT_SIZE_PX = 6;
const ACTIVE_DOT_BORDER_WIDTH_PX = 1;
const ACTIVE_DOT_EMPHASIS_SCALE = 1;
const SERIES_Z = 2;
const UNRESOLVED_COLOR = 'rgba(120, 120, 120, 1)';

export const DASH_PATTERN: [number, number] = [DASH_PX, DASH_PX];

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
		const color = seriesColor(palette, line.key);
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
				width: line.strokeWidth,
				type: line.stroke === 'solid' ? 'solid' : DASH_PATTERN,
			},
			itemStyle: activeDot,
			emphasis: {
				focus: 'none',
				scale: ACTIVE_DOT_EMPHASIS_SCALE,
				itemStyle: activeDot,
			},
		};
	});
}
