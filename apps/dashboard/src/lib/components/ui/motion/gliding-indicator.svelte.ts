/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useResizeObserver } from 'runed';
import { tick } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import { prefersReducedMotion } from 'svelte/motion';

const DEFAULT_ACTIVE_SELECTOR = '[data-glide-active]';

export const GLIDING_INDICATOR_CLASS =
	'pointer-events-none absolute top-0 left-0 rounded-full bg-surface-5 shadow-(--shadow-raised)';
export const GLIDING_INDICATOR_MOTION_CLASS =
	'transition-[translate,width,height] duration-(--motion-emphasis) ease-(--ease-enter)';

interface IndicatorRect {
	left: number;
	top: number;
	width: number;
	height: number;
}

export class GlidingIndicator {
	readonly #activeKey: () => unknown;
	readonly #selector: string;
	#container = $state<HTMLElement | null>(null);
	#rect = $state<IndicatorRect | null>(null);
	#settled = $state(false);

	constructor(activeKey: () => unknown, selector = DEFAULT_ACTIVE_SELECTOR) {
		this.#activeKey = activeKey;
		this.#selector = selector;
		$effect(() => {
			this.#activeKey();
			const container = this.#container;
			if (!container) return;
			void tick().then(() => this.#measure());
		});
		useResizeObserver(
			() => this.#container,
			() => this.#measure()
		);
	}

	readonly attach: Attachment<HTMLElement> = (node) => {
		this.#container = node;
		return () => {
			if (this.#container === node) this.#container = null;
		};
	};

	get visible(): boolean {
		return this.#rect !== null;
	}

	get animates(): boolean {
		return this.#settled && !prefersReducedMotion.current;
	}

	get translate(): string {
		const rect = this.#rect;
		return rect ? `${rect.left}px ${rect.top}px` : '0 0';
	}

	get width(): string {
		return `${this.#rect?.width ?? 0}px`;
	}

	get height(): string {
		return `${this.#rect?.height ?? 0}px`;
	}

	#measure(): void {
		const container = this.#container;
		const active = container?.querySelector<HTMLElement>(this.#selector);
		if (!container || !active) {
			this.#rect = null;
			return;
		}
		const hadRect = this.#rect !== null;
		this.#rect = {
			left: active.offsetLeft,
			top: active.offsetTop,
			width: active.offsetWidth,
			height: active.offsetHeight,
		};
		if (hadRect) this.#settled = true;
		else void tick().then(() => (this.#settled = true));
	}
}
