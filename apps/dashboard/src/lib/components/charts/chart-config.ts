/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

type CssColor = string;

export type ChartSeriesConfig = {
	label: string;
	color: CssColor;
};

export type ChartConfig<TSeriesKey extends string> = Record<
	TSeriesKey,
	ChartSeriesConfig
>;

export type ChartPalette<TSeriesKey extends string> = {
	series: ReadonlyMap<TSeriesKey, string>;
	mutedForeground: string;
	border: string;
	background: string;
};

const COLOR_CHANNEL_MAX = 255;
const MUTED_FOREGROUND_TOKEN = 'var(--text-muted)';
const BORDER_TOKEN = 'var(--border)';
const BACKGROUND_TOKEN = 'var(--bg)';
const ALPHA_DECIMALS = 3;
const PROBE_CSS =
	'position:absolute;width:0;height:0;visibility:hidden;pointer-events:none;';

let normalizerContext: CanvasRenderingContext2D | null = null;

function normalizeColor(value: string): string {
	const raw = value.trim();
	if (!raw) return raw;
	if (!normalizerContext) {
		const canvas = document.createElement('canvas');
		canvas.width = 1;
		canvas.height = 1;
		normalizerContext = canvas.getContext('2d', { willReadFrequently: true });
	}
	if (!normalizerContext) return raw;
	normalizerContext.clearRect(0, 0, 1, 1);
	normalizerContext.fillStyle = '#000';
	normalizerContext.fillStyle = raw;
	normalizerContext.fillRect(0, 0, 1, 1);
	const [r = 0, g = 0, b = 0, a = 0] = normalizerContext.getImageData(
		0,
		0,
		1,
		1
	).data;
	return `rgba(${r}, ${g}, ${b}, ${(a / COLOR_CHANNEL_MAX).toFixed(ALPHA_DECIMALS)})`;
}

export function resolveChartPalette<TSeriesKey extends string>(
	container: HTMLElement,
	config: ChartConfig<TSeriesKey>,
	seriesKeys: readonly TSeriesKey[]
): ChartPalette<TSeriesKey> {
	const readCssColor = (color: CssColor): string => {
		const probe = document.createElement('span');
		probe.style.cssText = PROBE_CSS;
		probe.style.color = color;
		container.appendChild(probe);
		const resolved = normalizeColor(getComputedStyle(probe).color);
		probe.remove();
		return resolved;
	};

	const palette = {
		series: new Map(
			seriesKeys.map((key): [TSeriesKey, string] => [
				key,
				readCssColor(config[key].color),
			])
		),
		mutedForeground: readCssColor(MUTED_FOREGROUND_TOKEN),
		border: readCssColor(BORDER_TOKEN),
		background: readCssColor(BACKGROUND_TOKEN),
	};
	return palette;
}
