/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const TEXT_INPUT_SELECTOR = [
	'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])' +
		':not([type="button"]):not([type="submit"]):not([type="reset"])' +
		':not([disabled]):not([readonly]):not([tabindex="-1"])',
	'textarea:not([disabled]):not([readonly]):not([tabindex="-1"])',
	'[contenteditable="true"]:not([tabindex="-1"])',
	'[contenteditable=""]:not([tabindex="-1"])',
].join(',');
export function isElementVisible(el: HTMLElement): boolean {
	return el.offsetParent !== null || el.getClientRects().length > 0;
}
export function focusFirstTextInputIn(root: HTMLElement | null): boolean {
	if (!root) return false;
	const target = Array.from(
		root.querySelectorAll<HTMLElement>(TEXT_INPUT_SELECTOR)
	).find(isElementVisible);
	if (!target) return false;
	target.focus({ preventScroll: false });
	if (
		target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement
	) {
		const end = target.value.length;
		try {
			target.setSelectionRange(end, end);
		} catch {}
	} else if (target.isContentEditable) {
		const range = document.createRange();
		range.selectNodeContents(target);
		range.collapse(false);
		const sel = window.getSelection();
		sel?.removeAllRanges();
		sel?.addRange(range);
	}
	return true;
}
export function focusFirstTextInput(event: Event): void {
	const { currentTarget } = event;
	if (
		currentTarget instanceof HTMLElement &&
		focusFirstTextInputIn(currentTarget)
	) {
		event.preventDefault();
	}
}
