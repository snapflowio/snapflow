/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { DITHER_RAMP_TOKENS } from '../dither-style';
import type { PaletteEntry } from '../webgl/shader-scene';

export const SCENE = {
	cameraHeight: 1,
	minimumAspect: 1.1,
	nearDepth: 1,
	cliffDepth: 8,
	cliffHeight: 1.4,
	ridgeRoughness: 0.12,
	pi: Math.PI,
} as const;

export const RIVER = {
	halfWidth: 0.7,
	widthVariation: 0.12,
	widthFrequency: 1.3,
	widthPhase: 0.7,
	bends: 2,
	bendAmplitude: 0.9,
	straightReach: 0.6,
	wobbleFrequency: 2.1,
	wobbleAmplitude: 0.12,
	flowSpeed: 0.55,
} as const;

export const WATERFALL = {
	fallSpeed: 1.6,
	lipWidth: 0.82,
	lipBand: 0.08,
	poolReach: 1.6,
	plungeHeight: 0.12,
	mistReach: 1.1,
	mistHeight: 0.4,
	mistStrength: 0.38,
	mistRise: 0.35,
} as const;

const RIPPLE_RINGS = 3;
const RIPPLE_RING_SECONDS = 1.9;
const RIPPLE_RING_STAGGER_SECONDS = 0.28;

export const RIPPLE = {
	capacity: 12,
	rings: RIPPLE_RINGS,
	ringSeconds: RIPPLE_RING_SECONDS,
	ringStaggerSeconds: RIPPLE_RING_STAGGER_SECONDS,
	lifetimeSeconds:
		RIPPLE_RING_SECONDS + RIPPLE_RING_STAGGER_SECONDS * (RIPPLE_RINGS - 1),
	ringFalloff: 0.6,
	maxRadius: 0.36,
	width: 0.012,
	widthGrowth: 1.5,
	drift: 0.12,
	clickStrength: 1,
	ambientIntervalMs: 900,
	ambientStrength: 0.7,
	ambientDepth: { min: 1.5, max: 6 },
	ambientAcross: 0.7,
} as const;

export const TERRAIN = {
	contourScale: 0.45,
	contourCount: 7,
	contourWidth: 0.16,
	contourStrength: 0.5,
	strataPerUnit: 9,
	strataWidth: 0.22,
	strataStrength: 0.6,
	rockFill: 0.3,
	rimWidth: 0.1,
	rimStrength: 0.7,
} as const;

export const GLINT = {
	rate: 5,
	threshold: 0.993,
	minimumBody: 0.56,
} as const;

export const EDGE_FADE = {
	top: 0.12,
	bottom: 0.24,
} as const;

const PAGE_TOKEN = '--snapflow-ink';

const [
	BANK_TOKEN,
	DEEP_TOKEN,
	MID_TOKEN,
	CURRENT_TOKEN,
	RIPPLE_TOKEN,
	GLINT_TOKEN,
] = DITHER_RAMP_TOKENS;

export const RIVER_PALETTE = [
	['u_bank', BANK_TOKEN],
	['u_deep', DEEP_TOKEN],
	['u_mid', MID_TOKEN],
	['u_current', CURRENT_TOKEN],
	['u_ripple', RIPPLE_TOKEN],
	['u_glint', GLINT_TOKEN],
	['u_page', PAGE_TOKEN],
] as const satisfies readonly PaletteEntry<string>[];

export const CLIFF_BASE_BELOW_HORIZON = SCENE.cameraHeight / SCENE.cliffDepth;

export function riverCenter(depth: number) {
	const progress = Math.min(
		Math.max(
			(depth - SCENE.nearDepth) / (SCENE.cliffDepth - SCENE.nearDepth),
			0
		),
		1
	);
	const bend =
		Math.sin(progress * SCENE.pi * RIVER.bends) *
		RIVER.bendAmplitude *
		Math.min(progress / RIVER.straightReach, 1);
	const wobble =
		Math.sin(depth * RIVER.wobbleFrequency) *
		RIVER.wobbleAmplitude *
		progress *
		(1 - progress) *
		4;
	return bend + wobble;
}

export function riverHalfWidth(depth: number) {
	return (
		RIVER.halfWidth *
		(1 +
			RIVER.widthVariation *
				Math.sin(depth * RIVER.widthFrequency + RIVER.widthPhase))
	);
}
