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

export type Triple = readonly [number, number, number];

export type Box = {
	center: Triple;
	half: Triple;
};

export type Sphere = {
	center: Triple;
	radius: number;
};

export const ROOM = {
	size: 4,
	height: 2.5,
	wallThickness: 0.14,
	slabThickness: 0.22,
	skirting: 0.07,
	boardWidth: 0.5,
	boardSeam: 0.04,
} as const;

export const WINDOW = {
	center: [2.2, 1.62, 0],
	half: [0.62, 0.45, 0.3],
	mullionHalfWidth: 0.018,
	mullionDepth: 0.03,
	sill: { center: [2.2, 1.14, 0.06], half: [0.72, 0.03, 0.09] },
} as const;

export const DESK = {
	top: { center: [1.05, 0.78, 0.45], half: [0.78, 0.035, 0.36] },
	legInset: 0.08,
	legHalfWidth: 0.035,
} as const;

export const MONITOR = {
	center: [1.05, 1.13, 0.22],
	half: [0.36, 0.22, 0.025],
	screenInset: 0.86,
	standHalfWidth: 0.03,
	light: [1.05, 1.13, 0.45],
	lightStrength: 0.9,
	lightFalloff: 4,
} as const;

export const KEYBOARD: Box = {
	center: [1.05, 0.83, 0.6],
	half: [0.26, 0.015, 0.08],
};

export const LAMP = {
	base: { center: [0.42, 0.83, 0.28], half: [0.07, 0.015, 0.07] },
	post: { center: [0.42, 1.0, 0.28], half: [0.014, 0.16, 0.014] },
	shade: { center: [0.42, 1.2, 0.34], half: [0.1, 0.055, 0.1] },
	light: [0.42, 1.08, 0.42],
	strength: 1.5,
	falloff: 3,
} as const;

export const CHAIR = {
	seat: { center: [1.05, 0.46, 1.15], half: [0.24, 0.035, 0.24] },
	back: { center: [1.05, 0.74, 1.37], half: [0.24, 0.24, 0.03] },
	post: { center: [1.05, 0.22, 1.15], half: [0.03, 0.22, 0.03] },
	base: { center: [1.05, 0.02, 1.15], half: [0.2, 0.02, 0.2] },
} as const;

export const MACHINE = {
	center: [3.32, 0.84, 0.46],
	half: [0.34, 0.84, 0.4],
	ledRows: [1.42, 1.17, 0.92, 0.67],
	bayHalfHeight: 0.1,
	bayInsetX: 0.05,
	ledHalfWidth: 0.05,
	ledHalfHeight: 0.022,
	ledInsetX: 0.09,
	ventTop: 0.42,
	ventPitch: 0.06,
	ventDuty: 0.4,
	ventDim: 0.5,
	statusRow: 0,
} as const;

export const CABLE = {
	floor: { center: [2.94, 0.014, 0.12], half: [0.08, 0.014, 0.014] },
	riser: { center: [2.86, 0.14, 0.12], half: [0.014, 0.13, 0.014] },
	port: { center: [2.86, 0.32, 0.04], half: [0.08, 0.06, 0.07] },
	pulseRate: 0.9,
	pulseWidth: 0.08,
	pulseLength: 0.5,
	start: 3.02,
	portShare: 0.5,
} as const;

export const SHELF = {
	board: { center: [0.13, 1.72, 2.0], half: [0.13, 0.02, 0.55] },
	items: [
		{ center: [0.13, 1.83, 1.6], half: [0.1, 0.09, 0.035] },
		{ center: [0.13, 1.81, 1.68], half: [0.1, 0.07, 0.035] },
		{ center: [0.13, 1.85, 1.77], half: [0.1, 0.11, 0.04] },
		{ center: [0.13, 1.8, 2.3], half: [0.08, 0.06, 0.08] },
	],
} as const satisfies { board: Box; items: readonly Box[] };

export const PLANT = {
	pot: { center: [0.36, 0.17, 2.5], half: [0.14, 0.17, 0.14] },
	leaves: [
		{ center: [0.36, 0.52, 2.5], radius: 0.2 },
		{ center: [0.24, 0.66, 2.42], radius: 0.14 },
		{ center: [0.48, 0.7, 2.58], radius: 0.13 },
	],
} as const satisfies { pot: Box; leaves: readonly Sphere[] };

export const RUG = {
	center: [2.0, 0.008, 2.15],
	half: [1.15, 0.008, 0.85],
	border: 0.84,
	borderLift: 0.7,
} as const;

export const MOON = {
	direction: [-0.25, -0.55, 1],
	position: [2.55, 1.85],
	radius: 0.15,
	softEdge: 0.7,
	patchLevel: 1.1,
	ambient: 0.25,
} as const;

export const SKY = {
	planeZ: -0.6,
	starDensity: 22,
	starChance: 0.94,
	twinkleRate: 0.7,
	twinkleSpread: 3,
	twinkleOn: 0.3,
	hillBase: 1.4,
	hillAmplitude: 0.12,
	hillFrequency: 2.3,
	hillHarmonicAmplitude: 0.5,
	hillHarmonicFrequency: 2.7,
	hillHarmonicPhase: 1.3,
	riverDepth: 1.5,
	riverHeight: 0.06,
	glintDensity: 2,
	glintRate: 2,
	glintChance: 0.45,
	gradientBase: 0.6,
	gradientSlope: 0.6,
} as const;

export const SHADING = {
	floor: 0.8,
	slab: 0.35,
	backWall: 0.95,
	leftWall: 0.7,
	frame: 1.5,
	desk: 1.2,
	monitor: 0.8,
	keyboard: 1.5,
	lampShade: 3.2,
	lampMetal: 1.3,
	chair: 0.95,
	machine: 1.1,
	rug: 1.15,
	shelf: 1.2,
	book: 1.5,
	pot: 1.1,
	leaves: 1.35,
	port: 0.9,
	cable: 0.7,
	faceTop: 0.6,
	faceFront: 0.25,
	machineWake: 0.5,
	machineLight: 3,
	machineFalloff: 1.1,
	machineOffset: [0, 0.4, 0.6],
	direct: 0.8,
	ambient: 0.2,
	idleGlow: 0.4,
	bayLift: 1.7,
	edgeBevel: 0.9,
	maxLevel: 4.6,
	screenOff: 0.6,
	screenLevel: 3.4,
	scanDensity: 40,
	scanSpeed: 0.5,
	scanDim: 0.4,
	facing: 0.5,
	busyRate: 6,
	busyChance: 0.35,
} as const;

export const CAMERA = {
	direction: [-1, -0.82, -1],
	margin: 1.06,
	distance: 20,
} as const;

export const MARCH = {
	steps: 90,
	epsilon: 0.002,
	maxDistance: 40,
	normalOffset: 0.003,
} as const;

export const SPARKS = {
	count: 7,
	secondsPerTrip: 4.5,
	arc: 0.45,
	halfCells: 1.2,
	fade: 0.4,
	colorSwitch: 0.5,
	depthBias: 0.02,
	start: [3.2, 1.75, 0.55],
	end: [2.2, 1.65, -0.5],
} as const;

export const FADE = {
	inner: 1.05,
	outer: 1.35,
	noiseScale: 2.4,
	noiseAmount: 0.08,
	guard: 0.02,
	glowStrength: 0.5,
	glowFalloff: 1.6,
} as const;

export const FRAME = {
	sceneSelector: '[data-night-shift-scene]',
	frameSelector: '[data-night-shift-frame]',
} as const;

export type NightShiftState = {
	power: number;
	rows: number;
	screen: number;
	link: number;
	work: number;
};

const ASLEEP: NightShiftState = {
	power: 0.2,
	rows: 1,
	screen: 0,
	link: 0,
	work: 0,
};

export const NIGHT_SHIFT_STEPS = {
	connect: {
		from: { power: 0, rows: 0, screen: 0, link: 0, work: 0 },
		to: { power: 1, rows: 1, screen: 1, link: 1, work: 0 },
	},
	limits: {
		from: null,
		to: { power: 1, rows: 3, screen: 1, link: 0, work: 0 },
	},
	control: {
		from: null,
		to: { power: 1, rows: 3, screen: 1, link: 0, work: 1 },
	},
} as const satisfies Record<
	string,
	{ from: NightShiftState | null; to: NightShiftState }
>;

export type NightShiftStep = keyof typeof NIGHT_SHIFT_STEPS;

export const SCHEDULE = {
	workSeconds: 3.4,
	sleepSeconds: 2.6,
	asleep: ASLEEP,
} as const;

export const EASING = {
	ratePerSecond: 2.4,
	maxFrameSeconds: 0.1,
	bootDelaySeconds: 0.4,
} as const;

export const STILL_FRAME_SECONDS = 2;

const SECTION_BACKGROUND_TOKEN = '--snapflow-ink';

const [DARKEST, NIGHT, NIGHT_BRIGHT, BRAND, BRAND_BRIGHT, PAPER] =
	DITHER_RAMP_TOKENS;

export const NIGHT_SHIFT_PALETTE = [
	['u_background', SECTION_BACKGROUND_TOKEN],
	['u_ink', DARKEST],
	['u_night', NIGHT],
	['u_nightBright', NIGHT_BRIGHT],
	['u_brand', BRAND],
	['u_brandBright', BRAND_BRIGHT],
	['u_paper', PAPER],
	['u_light', DITHER_LIGHT_TOKEN],
] as const;
