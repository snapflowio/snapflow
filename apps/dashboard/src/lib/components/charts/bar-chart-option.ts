/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	CHART_AXIS_FONT_FAMILY,
	CHART_AXIS_FONT_SIZE_PX,
	CHART_AXIS_LABEL_MARGIN_PX,
	CHART_GRID_INSET_PX,
	CHART_GRID_LINE_OPACITY,
	CHART_GRID_TOP_PX,
	CHART_Y_SPLITS,
} from './chart-layout.ts';
import type { ChartOption } from './echarts.ts';

const BAR_RADIUS_PX = 2;
const BAR_MAX_WIDTH_PX = 8;
const DIMMED_OPACITY = 0.75;
const FULL_OPACITY = 1;
const GRID_LINE_WIDTH_PX = 1;

export interface BarChartPalette {
	bar: string;
	highlight: string;
	axis: string;
	grid: string;
}

export interface BarChartPoint {
	label: string;
	value: number;
}

export interface BarChartOptionInput {
	data: readonly BarChartPoint[];
	palette: BarChartPalette;
	highlightIndex: number | null;
	hoverIndex: number | null;
	xFormat?: (label: string, index: number) => string;
	yFormat?: (value: number) => string;
}

function barColor(input: BarChartOptionInput, index: number): string {
	return index === input.highlightIndex
		? input.palette.highlight
		: input.palette.bar;
}

function barOpacity(input: BarChartOptionInput, index: number): number {
	if (input.hoverIndex === null || input.hoverIndex === index) {
		return FULL_OPACITY;
	}
	return DIMMED_OPACITY;
}

export function buildBarChartOption(input: BarChartOptionInput): ChartOption {
	const { palette } = input;
	const axisLabel = {
		show: true,
		color: palette.axis,
		fontFamily: CHART_AXIS_FONT_FAMILY,
		fontSize: CHART_AXIS_FONT_SIZE_PX,
		margin: CHART_AXIS_LABEL_MARGIN_PX,
	};
	return {
		animation: false,
		grid: {
			left: CHART_GRID_INSET_PX,
			right: CHART_GRID_INSET_PX,
			top: CHART_GRID_TOP_PX,
			bottom: CHART_GRID_INSET_PX,
			containLabel: true,
		},
		xAxis: {
			type: 'category',
			data: input.data.map((point) => point.label),
			axisLine: { show: false },
			axisTick: { show: false },
			axisLabel: {
				...axisLabel,
				formatter: input.xFormat,
			},
		},
		yAxis: {
			type: 'value',
			splitNumber: CHART_Y_SPLITS,
			axisLine: { show: false },
			axisTick: { show: false },
			splitLine: {
				show: true,
				lineStyle: {
					color: palette.grid,
					width: GRID_LINE_WIDTH_PX,
					opacity: CHART_GRID_LINE_OPACITY,
				},
			},
			axisLabel: {
				...axisLabel,
				formatter: input.yFormat,
			},
		},
		series: [
			{
				type: 'bar',
				barMaxWidth: BAR_MAX_WIDTH_PX,
				cursor: 'default',
				data: input.data.map((point, index) => ({
					value: point.value,
					itemStyle: {
						color: barColor(input, index),
						opacity: barOpacity(input, index),
						borderRadius: BAR_RADIUS_PX,
					},
				})),
				emphasis: { disabled: true },
			},
		],
	};
}
