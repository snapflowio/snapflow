/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const DITHER_STYLE = {
	cellSize: 3,
	bayerSize: 4,
	edgeLift: 1.1,
} as const;

export const BAYER_MATRIX = [
	[0, 8, 2, 10],
	[12, 4, 14, 6],
	[3, 11, 1, 9],
	[15, 7, 13, 5],
] as const;

export const BAYER_LEVELS = DITHER_STYLE.bayerSize * DITHER_STYLE.bayerSize;

export const BAYER_CELL_OFFSET = 1 / (2 * BAYER_LEVELS);

export const DITHER_RAMP_TOKENS = [
	'--snapflow-dither-0',
	'--snapflow-dither-1',
	'--snapflow-dither-2',
	'--snapflow-dither-3',
	'--snapflow-dither-4',
	'--snapflow-dither-5',
] as const;

export const DITHER_LIGHT_TOKEN = '--snapflow-dither-light';
