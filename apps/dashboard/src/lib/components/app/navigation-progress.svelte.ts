/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { untrack } from 'svelte';
import { cubicOut } from 'svelte/easing';
import { prefersReducedMotion, Tween } from 'svelte/motion';
import { navigating } from '$app/state';

const SHOW_DELAY_MILLISECONDS = 150;
const PENDING_PROGRESS = 0.9;
const PENDING_DURATION_MILLISECONDS = 10_000;
const COMPLETE_PROGRESS = 1;
const COMPLETE_DURATION_MILLISECONDS = 200;
const INSTANT = { duration: 0 } as const;

class NavigationProgressState {
	#visible = $state(false);
	#holds = $state(0);
	#active = false;
	readonly #progress = new Tween(0, { easing: cubicOut });

	get visible(): boolean {
		return this.#visible;
	}

	get value(): number {
		return this.#progress.current;
	}

	hold(): () => void {
		untrack(() => {
			this.#holds += 1;
		});
		return () => {
			untrack(() => {
				this.#holds -= 1;
			});
		};
	}

	track = (busy: () => boolean): void => {
		$effect(() => {
			const active = navigating.to !== null || this.#holds > 0 || busy();
			this.#active = active;
			return untrack(() => (active ? this.#start() : this.#complete()));
		});
	};

	#duration(milliseconds: number) {
		return prefersReducedMotion.current ? INSTANT : { duration: milliseconds };
	}

	#start(): () => void {
		const timer = setTimeout(() => {
			if (this.#visible) return;
			this.#visible = true;
			void this.#progress
				.set(0, INSTANT)
				.then(() =>
					this.#progress.set(
						PENDING_PROGRESS,
						this.#duration(PENDING_DURATION_MILLISECONDS)
					)
				);
		}, SHOW_DELAY_MILLISECONDS);
		return () => clearTimeout(timer);
	}

	#complete(): void {
		if (!this.#visible) return;
		void this.#progress
			.set(COMPLETE_PROGRESS, this.#duration(COMPLETE_DURATION_MILLISECONDS))
			.then(() => {
				if (!this.#active) this.#visible = false;
			});
	}
}

export const navigationProgress = new NavigationProgressState();
