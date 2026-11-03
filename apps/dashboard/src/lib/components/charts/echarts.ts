/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LineChart, type LineSeriesOption } from 'echarts/charts';
import {
	GridComponent,
	type GridComponentOption,
	TooltipComponent,
	type TooltipComponentOption,
} from 'echarts/components';
import { type ComposeOption, type ECharts, init, use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

export type ChartOption = ComposeOption<
	LineSeriesOption | GridComponentOption | TooltipComponentOption
>;

export function initChart(node: HTMLElement): ECharts {
	return init(node, null, { renderer: 'canvas' });
}
