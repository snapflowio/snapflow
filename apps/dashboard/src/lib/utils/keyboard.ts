/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const EDITABLE_SELECTOR =
	'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"], [role="combobox"]';
const MAC_PLATFORM = /mac|iphone|ipad|ipod/i;

export function isEditableTarget(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable || target.matches(EDITABLE_SELECTOR))
	);
}

export function isModKey(event: KeyboardEvent | MouseEvent): boolean {
	return event.metaKey || event.ctrlKey;
}

export function isMacPlatform(): boolean {
	return (
		typeof navigator !== 'undefined' && MAC_PLATFORM.test(navigator.userAgent)
	);
}

export function modKeyLabel(): string {
	return isMacPlatform() ? '⌘' : 'Ctrl+';
}

export function shortcutLabel(key: string): string {
	return `${modKeyLabel()}${key.toUpperCase()}`;
}
