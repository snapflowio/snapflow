/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createContext } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import {
	focusFirstTextInputIn,
	isElementVisible,
} from '#lib/components/ui/modal/auto-focus.ts';

const UNAVAILABLE_SELECTOR = ':disabled, [aria-disabled="true"]';
const INACTIVE_ANCESTOR_SELECTOR = '[aria-hidden="true"], [inert]';

function isAvailable(element: HTMLElement): boolean {
	return (
		!element.matches(UNAVAILABLE_SELECTOR) &&
		isElementVisible(element) &&
		!element.closest(INACTIVE_ANCESTOR_SELECTOR)
	);
}

function track(targets: Set<HTMLElement>): Attachment<HTMLElement> {
	return (element) => {
		targets.add(element);
		return () => {
			targets.delete(element);
		};
	};
}

function firstAvailable(targets: Set<HTMLElement>): HTMLElement | undefined {
	return [...targets].find(isAvailable);
}

export class ChipModalFocus {
	readonly #initial = new Set<HTMLElement>();
	readonly #fallback = new Set<HTMLElement>();
	readonly initial: Attachment<HTMLElement> = track(this.#initial);
	readonly fallback: Attachment<HTMLElement> = track(this.#fallback);

	focusOnOpen = (event: Event): void => {
		const content = event.currentTarget;
		if (!(content instanceof HTMLElement)) return;
		event.preventDefault();
		if (focusFirstTextInputIn(content)) return;
		const target =
			firstAvailable(this.#initial) ??
			firstAvailable(this.#fallback) ??
			content;
		target.focus();
		if (document.activeElement !== target) content.focus();
	};
}

export const [getChipModalFocus, setChipModalFocus] =
	createContext<ChipModalFocus>();
