/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const BODY = {
	halfWidth: 1.12,
	halfHeight: 0.82,
	cornerRadius: 0.16,
	depth: 0.42,
	bevelSize: 0.05,
	bevelThickness: 0.045,
	bevelSegments: 3,
	curveSegments: 12,
} as const;

export const SHACKLE = {
	points: [
		[-0.66, 0.55],
		[-0.66, 1.3],
		[-0.42, 1.63],
		[0, 1.75],
		[0.42, 1.63],
		[0.66, 1.3],
		[0.66, 0.55],
	],
	radius: 0.145,
	tubeSegments: 64,
	radialSegments: 10,
} as const;

export const KEYHOLE = {
	circleRadius: 0.18,
	circleSegments: 32,
	circleOffset: 0.11,
	stemWidth: 0.17,
	stemHeight: 0.38,
	stemOffset: -0.14,
	faceGap: 0.003,
} as const;

export const PADLOCK = {
	offsetY: -0.38,
	heightUnits: 4.7,
} as const;

export const MOTION = {
	startAngle: 0.45,
	spinRate: 0.5,
	tilt: -0.08,
	roll: -0.035,
	wobbleRate: 0.3,
	wobbleAngle: 0.045,
	maxFrameSeconds: 0.1,
} as const;

export const STILL_FRAME_SECONDS = 2.2;

export const CAMERA = {
	distance: 6,
	zoom: 90,
	near: 0.1,
	far: 30,
} as const;

export const FINISHES = {
	body: { densityOffset: 0.04, glint: false, sparkle: false },
	shackle: { densityOffset: 0.2, glint: false, sparkle: false },
} as const;
