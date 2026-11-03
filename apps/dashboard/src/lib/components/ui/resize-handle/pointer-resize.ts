/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Attachment } from 'svelte/attachments';

const PRIMARY_BUTTON = 0;
const RESIZE_CURSOR = 'ew-resize';
const NO_USER_SELECT = 'none';

export interface PointerResizeOptions {
	widthAt: (clientX: number) => number;
	onResize: (width: number) => void;
	onEnd?: (width: number | null) => void;
	resizingClass?: string;
}

function startResize(
	handle: HTMLElement,
	pointerId: number,
	options: PointerResizeOptions,
	onStop: () => void
): () => void {
	let animationFrame: number | null = null;
	let latestWidth: number | null = null;

	const render = () => {
		animationFrame = null;
		if (latestWidth !== null) options.onResize(latestWidth);
	};

	const move = (event: PointerEvent) => {
		latestWidth = options.widthAt(event.clientX);
		animationFrame ??= requestAnimationFrame(render);
	};

	const finish = () => {
		if (animationFrame !== null) {
			cancelAnimationFrame(animationFrame);
			render();
		}
		if (options.resizingClass) {
			document.documentElement.classList.remove(options.resizingClass);
		}
		document.body.style.cursor = '';
		document.body.style.userSelect = '';
		if (handle.hasPointerCapture(pointerId)) {
			handle.releasePointerCapture(pointerId);
		}
		document.removeEventListener('pointermove', move);
		document.removeEventListener('pointerup', finish);
		document.removeEventListener('pointercancel', finish);
		window.removeEventListener('blur', finish);
		onStop();
		options.onEnd?.(latestWidth);
	};

	if (options.resizingClass) {
		document.documentElement.classList.add(options.resizingClass);
	}
	document.body.style.cursor = RESIZE_CURSOR;
	document.body.style.userSelect = NO_USER_SELECT;
	handle.setPointerCapture(pointerId);
	document.addEventListener('pointermove', move);
	document.addEventListener('pointerup', finish);
	document.addEventListener('pointercancel', finish);
	window.addEventListener('blur', finish);
	return finish;
}

export function pointerResize(
	options: PointerResizeOptions
): Attachment<HTMLElement> {
	return (handle) => {
		let stop: (() => void) | null = null;

		const begin = (event: PointerEvent) => {
			if (stop || event.button !== PRIMARY_BUTTON) return;
			event.preventDefault();
			stop = startResize(handle, event.pointerId, options, () => {
				stop = null;
			});
		};

		handle.addEventListener('pointerdown', begin);
		return () => {
			handle.removeEventListener('pointerdown', begin);
			stop?.();
		};
	};
}
