/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	createVirtualizer,
	type ScrollToOptions,
	type VirtualItem,
} from '@tanstack/svelte-virtual';
import { untrack } from 'svelte';
import { fromStore } from 'svelte/store';

export interface VirtualListOptions {
	count: number;
	estimateSize: (index: number) => number;
	overscan: number;
	scrollElement: HTMLElement | null;
}

function virtualizerOptions(options: VirtualListOptions) {
	const { scrollElement, ...rest } = options;
	return { ...rest, getScrollElement: () => scrollElement };
}

export class VirtualList {
	readonly #virtualizer;

	constructor(options: () => VirtualListOptions) {
		const initialOptions = {
			get count() {
				return options().count;
			},
			get estimateSize() {
				return options().estimateSize;
			},
			get overscan() {
				return options().overscan;
			},
			getScrollElement: () => options().scrollElement,
		};
		this.#virtualizer = fromStore(
			createVirtualizer<HTMLElement, HTMLElement>(initialOptions)
		);
		$effect(() => {
			const next = virtualizerOptions(options());
			untrack(() => this.#virtualizer.current.setOptions(next));
		});
	}

	get items(): VirtualItem[] {
		return this.#virtualizer.current.getVirtualItems();
	}

	get totalSize(): number {
		return this.#virtualizer.current.getTotalSize();
	}

	scrollToIndex = (index: number, options?: ScrollToOptions): void => {
		this.#virtualizer.current.scrollToIndex(index, options);
	};
}
