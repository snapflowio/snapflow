/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	DITHER_LIGHT_TOKEN,
	DITHER_RAMP_TOKENS,
} from '@/components/landing/visuals/dither-style';

export const FIELD = {
	horizon: 0.7,
	focalLength: 1,
	cameraHeight: 2.6,
	maxSteps: 48,
	maxDistance: 30,
	firstRow: 2,
	aisleEvery: 3,
	emptyChance: 0.2,
	halfWidth: 0.3,
	halfDepth: 0.36,
	towerChance: 0.97,
	fogNear: 4,
	fogFar: 26,
} as const;

export const RACK = {
	unitPitch: 0.15,
	minUnits: 4,
	maxUnits: 5,
	towerUnits: 3,
	unitSeam: 0.12,
	unitSeamDim: 0.6,
	ventLeft: -0.72,
	ventRight: 0.2,
	ventBottom: 0.4,
	ventTop: 0.62,
	ventCount: 5,
	ventDuty: 0.45,
	ventDim: 0.7,
	bevelEdge: 0.88,
	bevelTop: 0.035,
	panelColumns: 2,
	panelRows: 3,
	panelSeam: 0.07,
	panelDim: 0.5,
	panelSeamLift: 0.5,
	detailNear: 7,
	detailFar: 14,
} as const;

export const SHADING = {
	top: 2.7,
	front: 1.8,
	side: 1.2,
	heightGain: 0.4,
	far: 0,
	outline: 0.05,
	outlineEdge: 0.86,
} as const;

export const LEDS = {
	left: 0.42,
	right: 0.66,
	bottom: 0.38,
	top: 0.64,
	offDim: 0.9,
	rate: 0.6,
	onChance: 0.8,
	maxDistance: 13,
} as const;

export const PLACEMENT = {
	sweepSeconds: 7,
	sweepRange: 7,
	sweepWidth: 0.6,
	pickSeconds: 6,
	pickSpanX: 2,
	pickNearRow: 5,
	pickRows: 4,
	pickAttempts: 8,
	beamRadius: 0.06,
	beamHeight: 1.4,
	poolStrength: 0.7,
	stillFramePicks: 4.5,
} as const;

export const GROUND = {
	gridWidth: 0.04,
	gridLevel: 0.35,
	hazeFalloff: 14,
	hazeStrength: 0.15,
} as const;

export const VIGNETTE = {
	centerY: 0.32,
	radiusX: 0.56,
	radiusY: 0.56,
	inner: 0.35,
	noiseScale: 2.2,
	noiseAmount: 0.12,
	guard: 0.04,
} as const;

export const CLEAR_ZONE = {
	selector: '[data-scene-heading]',
	padding: 1.15,
	minRadius: 0.01,
	falloff: 1.45,
} as const;

const PAGE_BACKGROUND_TOKEN = '--snapflow-ink';

const [, NIGHT, NIGHT_BRIGHT, BRAND, BRAND_BRIGHT, PAPER] = DITHER_RAMP_TOKENS;

export const MACHINE_FIELD_PALETTE = [
	['u_ink', PAGE_BACKGROUND_TOKEN],
	['u_night', NIGHT],
	['u_nightBright', NIGHT_BRIGHT],
	['u_brand', BRAND],
	['u_brandBright', BRAND_BRIGHT],
	['u_paper', PAPER],
	['u_aqua', DITHER_LIGHT_TOKEN],
] as const;

export const STILL_FRAME_SECONDS =
	PLACEMENT.pickSeconds * PLACEMENT.stillFramePicks;
