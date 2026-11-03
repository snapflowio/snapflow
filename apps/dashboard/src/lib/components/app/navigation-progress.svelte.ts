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
import { Tween } from 'svelte/motion';
import { navigating } from '$app/state';

const SHOW_DELAY_MILLISECONDS = 150;
const PENDING_PROGRESS = 0.9;
const PENDING_DURATION_MILLISECONDS = 10_000;
const COMPLETE_PROGRESS = 1;
const COMPLETE_DURATION_MILLISECONDS = 200;
const INSTANT = { duration: 0 } as const;

export class NavigationProgress {
	visible = $state(false);
	readonly #progress = new Tween(0, { easing: cubicOut });

	constructor() {
		$effect(() => {
			const destination = navigating.to;
			return untrack(() => (destination ? this.#start() : this.#complete()));
		});
	}

	get value(): number {
		return this.#progress.current;
	}

	#start(): () => void {
		const timer = setTimeout(() => {
			if (this.visible) return;
			this.visible = true;
			void this.#progress.set(0, INSTANT).then(() =>
				this.#progress.set(PENDING_PROGRESS, {
					duration: PENDING_DURATION_MILLISECONDS,
				})
			);
		}, SHOW_DELAY_MILLISECONDS);
		return () => clearTimeout(timer);
	}

	#complete(): void {
		if (!this.visible) return;
		void this.#progress
			.set(COMPLETE_PROGRESS, { duration: COMPLETE_DURATION_MILLISECONDS })
			.then(() => {
				if (!navigating.to) this.visible = false;
			});
	}
}
