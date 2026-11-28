/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const SKELETON_DELAY_MS = 300;
export const SKELETON_PULSE_DELAY_MS = 700;

type DelaySource = number | (() => number);

function readDelay(source: DelaySource): number {
	return typeof source === 'function' ? source() : source;
}

export class DelayedReveal {
	#visible = $state(false);

	constructor(delayMs: DelaySource = SKELETON_DELAY_MS) {
		$effect(() => {
			const timer = setTimeout(() => {
				this.#visible = true;
			}, readDelay(delayMs));
			return () => clearTimeout(timer);
		});
	}

	get visible(): boolean {
		return this.#visible;
	}
}
