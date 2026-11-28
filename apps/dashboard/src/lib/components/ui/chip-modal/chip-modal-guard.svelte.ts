/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createContext, onDestroy } from 'svelte';

export const UNSAVED_ESCAPE_WINDOW_MS = 2000;
export const UNSAVED_HINT = 'You have unsaved input. Use × to close.';

export class ChipModalGuard {
	readonly #unsaved: () => boolean;
	#lastEscapeAt = Number.NEGATIVE_INFINITY;
	#timer: ReturnType<typeof setTimeout> | null = null;
	flashCount = $state(0);
	hinting = $state(false);

	constructor(unsaved: () => boolean) {
		this.#unsaved = unsaved;
		onDestroy(() => this.#clearTimer());
	}

	get unsaved(): boolean {
		return this.#unsaved();
	}

	guardEscape = (event: KeyboardEvent): void => {
		if (!this.#unsaved()) return;
		const now = performance.now();
		if (now - this.#lastEscapeAt <= UNSAVED_ESCAPE_WINDOW_MS) return;
		this.#lastEscapeAt = now;
		event.preventDefault();
		this.flash();
	};

	guardOutside = (event: PointerEvent): void => {
		if (!this.#unsaved()) return;
		event.preventDefault();
		this.flash();
	};

	flash(): void {
		this.flashCount += 1;
		this.hinting = true;
		this.#clearTimer();
		this.#timer = setTimeout(() => {
			this.#timer = null;
			this.hinting = false;
		}, UNSAVED_ESCAPE_WINDOW_MS);
	}

	#clearTimer(): void {
		if (this.#timer === null) return;
		clearTimeout(this.#timer);
		this.#timer = null;
	}
}

const [getChipModalGuard, setChipModalGuard, hasChipModalGuard] =
	createContext<ChipModalGuard>();

export { setChipModalGuard };

export function findChipModalGuard(): ChipModalGuard | null {
	return hasChipModalGuard() ? getChipModalGuard() : null;
}
