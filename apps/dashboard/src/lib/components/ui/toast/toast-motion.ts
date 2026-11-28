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
import { MotionToken, motionSeconds } from '#lib/components/ui/motion.ts';

const MS_PER_SECOND = 1000;
const EXIT_MS = 150;

export const EXIT_DURATION = EXIT_MS / MS_PER_SECOND;
export const INSTANT = { duration: 0 } as const;

export function stackDuration(): number {
	return motionSeconds(MotionToken.EMPHASIS);
}

export function resizeDuration(): number {
	return motionSeconds(MotionToken.STANDARD);
}

export function motionOut(
	node: Element,
	keyframes: DOMKeyframesDefinition,
	transition: AnimationOptions & { duration: number }
): TransitionConfig {
	animate(node, keyframes, transition);
	return { duration: transition.duration * MS_PER_SECOND };
}
