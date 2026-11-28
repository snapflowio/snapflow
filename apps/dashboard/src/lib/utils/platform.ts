/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { isMacPlatform } from '#lib/utils/keyboard.ts';

export type ModifierKey = 'mod' | 'alt' | 'shift';

const MODIFIER_ORDER: readonly ModifierKey[] = ['mod', 'alt', 'shift'];

const MAC_MODIFIER_GLYPHS: Record<ModifierKey, string> = {
	mod: '⌘',
	alt: '⌥',
	shift: '⇧',
};

const OTHER_MODIFIER_GLYPHS: Record<ModifierKey, string> = {
	mod: 'Ctrl',
	alt: 'Alt',
	shift: 'Shift',
};

const KEY_ALIASES: Record<string, string> = {
	enter: '↵',
	return: '↵',
	escape: 'esc',
	esc: 'esc',
	up: '↑',
	down: '↓',
	left: '←',
	right: '→',
	arrowup: '↑',
	arrowdown: '↓',
	arrowleft: '←',
	arrowright: '→',
};

function isModifierKey(key: string): key is ModifierKey {
	return (MODIFIER_ORDER as readonly string[]).includes(key);
}

export function modifierGlyph(key: ModifierKey): string {
	return isMacPlatform()
		? MAC_MODIFIER_GLYPHS[key]
		: OTHER_MODIFIER_GLYPHS[key];
}

export function formatShortcutKeys(keys: readonly string[]): string[] {
	const modifiers: ModifierKey[] = [];
	const rest: string[] = [];
	for (const key of keys) {
		const normalized = key.toLowerCase();
		if (isModifierKey(normalized)) {
			modifiers.push(normalized);
		} else {
			rest.push(KEY_ALIASES[normalized] ?? key);
		}
	}
	modifiers.sort(
		(left, right) =>
			MODIFIER_ORDER.indexOf(left) - MODIFIER_ORDER.indexOf(right)
	);
	return [...modifiers.map(modifierGlyph), ...rest];
}
