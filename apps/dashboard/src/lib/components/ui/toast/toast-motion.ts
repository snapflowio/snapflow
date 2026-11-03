/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type AnimationOptions,
	animate,
	type DOMKeyframesDefinition,
} from 'motion';
import type { TransitionConfig } from 'svelte/transition';

const TOAST_EASE_X1 = 0.22;
const TOAST_EASE_Y1 = 1;
const TOAST_EASE_X2 = 0.36;
const TOAST_EASE_Y2 = 1;
const MS_PER_SECOND = 1000;

export const TOAST_EASE = [
	TOAST_EASE_X1,
	TOAST_EASE_Y1,
	TOAST_EASE_X2,
	TOAST_EASE_Y2,
] as const;
export const STACK_DURATION = 0.4;
export const RESIZE_DURATION = 0.3;
export const INSTANT = { duration: 0 } as const;

export function motionOut(
	node: Element,
	keyframes: DOMKeyframesDefinition,
	transition: AnimationOptions & { duration: number }
): TransitionConfig {
	animate(node, keyframes, transition);
	return { duration: transition.duration * MS_PER_SECOND };
}
