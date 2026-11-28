/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { DITHER_RAMP_TOKENS } from '@/components/landing/visuals/dither-style';

export const PLANET = {
	wideRadiusOfWidth: 0.43,
	narrowRadiusOfWidth: 0.62,
	narrowBreakpoint: 769,
	tilt: 0.12,
	facingLongitude: -25,
	rotationSpeed: 0.03,
	stillFrameSeconds: 0,
} as const;

export const SHADING = {
	ocean: 0.75,
	oceanLight: 1.05,
	land: 2.6,
	landLight: 1.75,
	landNight: 2,
	oceanNight: 0.45,
	terminatorWidth: 0.3,
	terminatorOffset: 0.1,
	lightX: -0.5,
	lightY: 0.7,
	lightZ: 0.65,
	rimStart: 0.9,
	coastline: 0.5,
} as const;

export const HALO = {
	falloff: 3.2,
	strength: 1.15,
	topFade: 0.18,
} as const;

export const BLEND = {
	sideFade: 0.14,
	planetSideFade: 0.04,
	noiseScale: 3,
	noiseAmount: 0.04,
} as const;

const PAGE_BACKGROUND_TOKEN = '--snapflow-ink';

const [, NIGHT, NIGHT_BRIGHT, BRAND, BRAND_BRIGHT, PAPER] = DITHER_RAMP_TOKENS;

export const GLOBE_HORIZON_PALETTE = [
	['u_ink', PAGE_BACKGROUND_TOKEN],
	['u_night', NIGHT],
	['u_nightBright', NIGHT_BRIGHT],
	['u_brand', BRAND],
	['u_brandBright', BRAND_BRIGHT],
	['u_paper', PAPER],
] as const;
