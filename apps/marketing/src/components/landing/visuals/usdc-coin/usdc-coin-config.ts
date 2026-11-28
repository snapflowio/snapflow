/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const COIN = {
	radius: 1,
	fieldRadius: 0.78,
	rimBevel: 0.07,
	rimHeight: 0.12,
	fieldHeight: 0.07,
	chamfer: 0.03,
	scale: 1.3,
	segments: 96,
} as const;

export const REEDING = {
	count: 84,
	depth: 0.028,
	widthFraction: 0.5,
	heightFraction: 0.84,
} as const;

export const BEADS = {
	radius: 0.7,
	ringRadius: 0.016,
	tubeSegments: 8,
	ringSegments: 96,
} as const;

export const DOLLAR = {
	bowlRadius: 0.2,
	terminalAngle: 0.45,
	strokeRadius: 0.062,
	tickLength: 0.12,
	tickGap: 0.02,
	sink: 0.025,
	pathPoints: 64,
	tubeSegments: 96,
	radialSegments: 10,
	capSegments: 6,
} as const;

export const MOTION = {
	spinRate: 0.38,
	startAngle: -0.5,
	tilt: -0.14,
	roll: 0.05,
	wobbleRate: 0.35,
	wobbleAngle: 0.05,
	maxFrameSeconds: 0.1,
} as const;

export const STILL_FRAME_SECONDS = 2.2;

export const WARMUP_FRAMES = 2;

export const CAMERA = {
	distance: 10,
	near: 0.1,
	far: 30,
	coinFraction: 0.76,
} as const;

export const MINIMUM_CELL_DEVICE_PIXELS = 1;

export const LIGHTING = {
	keyDirection: [-0.65, 0.8, 1],
	fillDirection: [0.8, -0.3, 0.6],
	ambient: 0.08,
	key: 0.55,
	fill: 0.14,
	falloff: 0.2,
	falloffAcross: 0.6,
	rimPower: 2.6,
	bandWidth: 0.5,
	glintRate: 4,
	glintThreshold: 0.985,
	glintMinimumKey: 0.9,
} as const;

export const GLINT_SWEEP = {
	speed: 1.1,
	period: 9,
	offset: 3,
	width: 0.22,
	slant: 0.6,
	amount: 1.4,
} as const;

export const FINISHES = {
	rim: { densityOffset: 0.2, glint: true },
	edge: { densityOffset: -0.08, glint: false },
	field: { densityOffset: 0.04, glint: false },
	emblem: { densityOffset: 0.26, glint: true },
} as const;
