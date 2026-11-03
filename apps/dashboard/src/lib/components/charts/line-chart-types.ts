/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ChartConfig, ChartPalette } from './chart-config.ts';

type LineChartXValue = string | number | Date;

export type LineStroke = 'solid' | 'dashed';

export type LineChartSeries<TSeriesKey extends string> = {
	key: TSeriesKey;
	stroke: LineStroke;
	strokeWidth: number;
};

export type LineChartRow<
	TXKey extends string,
	TSeriesKey extends string,
> = Record<TXKey, LineChartXValue> & Record<TSeriesKey, number | null>;

export type LineChartXAxis<TXValue> = {
	format?: (value: TXValue, index: number) => string;
};

export type LineChartYAxis = {
	format?: (value: number, index: number) => string;
	tickCount?: number;
};

export type LineChartTooltip<TXValue> = {
	labelFormat?: (label: TXValue) => string;
	valueFormat?: (value: number) => string;
};

export type LineChartOptionInput<
	TXKey extends string,
	TSeriesKey extends string,
	TRow extends LineChartRow<TXKey, TSeriesKey>,
> = {
	data: readonly TRow[];
	xKey: TXKey;
	series: readonly LineChartSeries<TSeriesKey>[];
	config: ChartConfig<NoInfer<TSeriesKey>>;
	palette: ChartPalette<NoInfer<TSeriesKey>>;
	xAxis?: LineChartXAxis<TRow[TXKey]>;
	yAxis?: LineChartYAxis;
	tooltip?: LineChartTooltip<TRow[TXKey]>;
	legend: boolean;
	animate: boolean;
};
