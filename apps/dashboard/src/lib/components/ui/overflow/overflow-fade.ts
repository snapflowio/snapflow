/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useMutationObserver, useResizeObserver } from 'runed';
import type { Attachment } from 'svelte/attachments';

const OVERFLOW_ATTRIBUTE = 'data-overflowing';
const OVERFLOW_TOLERANCE_PX = 1;
const FADE_CLASS = 'overflow-fade';

export function isOverflowing(element: HTMLElement): boolean {
	return element.scrollWidth - element.clientWidth > OVERFLOW_TOLERANCE_PX;
}

export function observeOverflow(
	element: HTMLElement,
	onChange: (overflowing: boolean) => void
): void {
	let current: boolean | null = null;
	const check = () => {
		const next = isOverflowing(element);
		if (next === current) return;
		current = next;
		onChange(next);
	};
	useResizeObserver(() => element, check);
	useMutationObserver(() => element, check, {
		characterData: true,
		childList: true,
		subtree: true,
	});
	check();
}

export const overflowFade: Attachment<HTMLElement> = (element) => {
	observeOverflow(element, (overflowing) => {
		element.toggleAttribute(OVERFLOW_ATTRIBUTE, overflowing);
		element.classList.toggle(FADE_CLASS, overflowing);
	});
};
