/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { TooltipComponentFormatterCallbackParams } from 'echarts';
import type { TooltipComponentOption } from 'echarts/components';
import { DISPLAY_LOCALE } from '#lib/utils/format.ts';
import { DASH_PATTERN, seriesColor } from './line-chart-series.ts';
import {
	type LineChartTooltipModel,
	renderLineChartTooltip,
} from './line-chart-tooltip.ts';
import type { LineChartOptionInput, LineChartRow } from './line-chart-types.ts';

const AXIS_POINTER_WIDTH_PX = 0.8;

function describeTooltipPoint<
	TXKey extends string,
	TSeriesKey extends string,
	TRow extends LineChartRow<TXKey, TSeriesKey>,
>(
	input: LineChartOptionInput<TXKey, TSeriesKey, TRow>,
	dataIndex: number
): LineChartTooltipModel | null {
	const row = input.data[dataIndex];
	if (!row) return null;
	const { labelFormat, valueFormat } = input.tooltip ?? {};
	const x = row[input.xKey];
	return {
		label: labelFormat ? labelFormat(x) : String(x),
		rows: input.series.map((line) => {
			const value = row[line.key] ?? 0;
			return {
				label: input.config[line.key].label,
				value: valueFormat
					? valueFormat(value)
					: value.toLocaleString(DISPLAY_LOCALE),
				color: seriesColor(input.palette, line.key),
			};
		}),
	};
}

function hoveredDataIndex(
	params: TooltipComponentFormatterCallbackParams
): number | undefined {
	return Array.isArray(params) ? params[0]?.dataIndex : params.dataIndex;
}

export function buildLineChartTooltipOption<
	TXKey extends string,
	TSeriesKey extends string,
	TRow extends LineChartRow<TXKey, TSeriesKey>,
>(
	input: LineChartOptionInput<TXKey, TSeriesKey, TRow>
): TooltipComponentOption {
	return {
		show: true,
		trigger: 'axis',
		confine: true,
		displayTransition: false,
		backgroundColor: 'transparent',
		borderWidth: 0,
		padding: 0,
		extraCssText: 'box-shadow:none;',
		axisPointer: {
			type: 'line',
			lineStyle: {
				color: input.palette.border,
				width: AXIS_POINTER_WIDTH_PX,
				type: DASH_PATTERN,
			},
		},
		formatter: (params) => {
			const dataIndex = hoveredDataIndex(params);
			const model =
				dataIndex === undefined ? null : describeTooltipPoint(input, dataIndex);
			return model ? renderLineChartTooltip(model) : '';
		},
	};
}
