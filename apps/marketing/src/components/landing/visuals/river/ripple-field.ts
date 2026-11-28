/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	CLIFF_BASE_BELOW_HORIZON,
	RIPPLE,
	riverCenter,
	riverHalfWidth,
	SCENE,
} from './river-config';

const RIPPLE_COMPONENTS = 4;

export type ScreenPoint = {
	x: number;
	y: number;
};

export type Projection = {
	horizon: number;
	aspect: number;
};

function randomBetween(min: number, max: number) {
	return min + Math.random() * (max - min);
}

export function createRippleField() {
	const data = new Float32Array(RIPPLE.capacity * RIPPLE_COMPONENTS);
	let next = 0;

	const add = (
		worldX: number,
		depth: number,
		time: number,
		strength: number
	) => {
		data.set([worldX, depth, time, strength], next * RIPPLE_COMPONENTS);
		next = (next + 1) % RIPPLE.capacity;
	};

	return {
		data,
		addAtScreen(
			point: ScreenPoint,
			projection: Projection,
			time: number,
			strength: number
		) {
			const below = projection.horizon - point.y;
			if (below <= CLIFF_BASE_BELOW_HORIZON) return;
			const depth = SCENE.cameraHeight / below;
			add((point.x - 0.5) * projection.aspect * depth, depth, time, strength);
		},
		addAmbient(time: number) {
			const depth = randomBetween(
				RIPPLE.ambientDepth.min,
				RIPPLE.ambientDepth.max
			);
			const across = randomBetween(-RIPPLE.ambientAcross, RIPPLE.ambientAcross);
			add(
				riverCenter(depth) + across * riverHalfWidth(depth),
				depth,
				time,
				RIPPLE.ambientStrength
			);
		},
	};
}
