/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { onDestroy } from 'svelte';

const COPIED_RESET_MS = 2000;

interface DeferredClipboardContent {
	fallback: string;
	prepare: () => Promise<string>;
}

type ClipboardContent = string | DeferredClipboardContent;

function writeTextToClipboard(content: ClipboardContent): Promise<void> {
	if (typeof content === 'string')
		return navigator.clipboard.writeText(content);
	if (
		typeof ClipboardItem !== 'undefined' &&
		typeof navigator.clipboard.write === 'function'
	) {
		const blob = Promise.resolve()
			.then(() => content.prepare())
			.then((value) => new Blob([value], { type: 'text/plain' }));
		return navigator.clipboard.write([
			new ClipboardItem({ 'text/plain': blob }),
		]);
	}
	return navigator.clipboard.writeText(content.fallback);
}

export class CopyToClipboard {
	#copied = $state(false);
	#copyFailed = $state(false);
	#timer: ReturnType<typeof setTimeout> | null = null;

	constructor() {
		onDestroy(() => this.#clearTimer());
	}

	get copied(): boolean {
		return this.#copied;
	}

	get copyFailed(): boolean {
		return this.#copyFailed;
	}

	copy = async (content: ClipboardContent): Promise<boolean> => {
		this.#copyFailed = false;
		try {
			await writeTextToClipboard(content);
			this.#copied = true;
			this.#clearTimer();
			this.#timer = setTimeout(() => {
				this.#timer = null;
				this.#copied = false;
			}, COPIED_RESET_MS);
			return true;
		} catch {
			this.#copied = false;
			this.#copyFailed = true;
			return false;
		}
	};

	reset = (): void => {
		this.#clearTimer();
		this.#copied = false;
		this.#copyFailed = false;
	};

	#clearTimer(): void {
		if (this.#timer === null) return;
		clearTimeout(this.#timer);
		this.#timer = null;
	}
}
