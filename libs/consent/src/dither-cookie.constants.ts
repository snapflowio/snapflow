/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export const COOKIE_SPACE = 40;
export const DITHER_CELL_SIZE = 3;

export const BAYER_SIZE = 4;
export const BAYER_MATRIX = [
	0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5,
];
export const BAYER_LEVELS = BAYER_SIZE * BAYER_SIZE;
export const CENTER = COOKIE_SPACE / 2;
export const COOKIE_RADIUS = 16.5;
export const EDGE_WOBBLE = [
	{ frequency: 6, amplitude: 1.1, phase: 0.7 },
	{ frequency: 11, amplitude: 0.5, phase: 2.1 },
] as const;
export const CHIPS = [
	{ x: -6, y: -5, radius: 2.4 },
	{ x: 5, y: -8, radius: 1.9 },
	{ x: 7, y: 3, radius: 2.6 },
	{ x: -3, y: 6, radius: 2.2 },
	{ x: -10, y: 3, radius: 1.6 },
	{ x: 1, y: -1, radius: 1.5 },
	{ x: 10, y: -3, radius: 1.3 },
] as const;
export const BITES = [
	{ x: 13, y: -12, radius: 7 },
	{ x: 17, y: -4, radius: 5 },
	{ x: 7, y: -17, radius: 5 },
] as const;
export const AMBIENT_LIGHT = 0.18;
export const DIRECT_LIGHT = 0.82;
export const LIGHT_ELEVATION = 0.85;
export const LIGHT_RADIANS_PER_MILLISECOND = 0.0007;
export const TEXTURE_STRENGTH = 0.14;
export const BITE_DURATION_MILLISECONDS = 360;
export const DISSOLVE_DURATION_MILLISECONDS = 520;
export const OPAQUE = 255;

export const COOKIE_TONE_PROPERTIES = [
	'--consent-cookie-1',
	'--consent-cookie-2',
	'--consent-cookie-3',
	'--consent-cookie-4',
	'--consent-cookie-5',
] as const;
export const CHIP_TONE_PROPERTY = '--consent-cookie-chip';
export const RGB_CHANNELS = 3;

export const PIXEL_CENTER = 0.5;
export const RGBA_CHANNELS = 4;
export const INITIAL_LIGHT_ANGLE = -Math.PI / 4;
export const EASE_OUT_POWER = 3;
export const TEXTURE_SEED_X = 12.9898;
export const TEXTURE_SEED_Y = 78.233;
export const TEXTURE_SEED_SCALE = 43_758.5453;
export const TEXTURE_MIDPOINT = 0.5;
export const ALPHA_CHANNEL = 3;
