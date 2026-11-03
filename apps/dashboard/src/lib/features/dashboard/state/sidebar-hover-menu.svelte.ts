/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { onDestroy } from 'svelte';

import { SIDEBAR_FLYOUT_CLOSE_DELAY_MS } from '#lib/features/dashboard/lib/sidebar-constants.ts';

const preventAutoFocus = (event: Event) => event.preventDefault();

export class SidebarHoverMenu {
	open = $state(false);
	#closeTimer: ReturnType<typeof setTimeout> | null = null;
	#hoveredRegions = 0;

	constructor() {
		onDestroy(() => this.#cancelClose());
	}

	#cancelClose(): void {
		if (this.#closeTimer) {
			clearTimeout(this.#closeTimer);
			this.#closeTimer = null;
		}
	}

	#scheduleClose(): void {
		this.#cancelClose();
		this.#closeTimer = setTimeout(() => {
			if (this.#hoveredRegions === 0) this.open = false;
		}, SIDEBAR_FLYOUT_CLOSE_DELAY_MS);
	}

	#enter = (): void => {
		this.#hoveredRegions += 1;
		this.#cancelClose();
		this.open = true;
	};

	#leave = (): void => {
		this.#hoveredRegions = Math.max(0, this.#hoveredRegions - 1);
		this.#scheduleClose();
	};

	readonly triggerProps = {
		onmouseenter: this.#enter,
		onmouseleave: this.#leave,
	};

	readonly contentProps = {
		onCloseAutoFocus: preventAutoFocus,
		onmouseenter: this.#enter,
		onmouseleave: this.#leave,
	};
}
