/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { PaletteScopeId } from './palette-scopes.ts';

const RECENTS_STORAGE_KEY = 'snapflow-palette-recents';
const RECENT_LIMIT = 5;
const SCOPE_IDS: ReadonlySet<unknown> = new Set(Object.values(PaletteScopeId));

export interface PaletteRecent {
	id: string;
	label: string;
	href: string;
	scope: PaletteScopeId | null;
}

function isPaletteRecent(value: unknown): value is PaletteRecent {
	if (typeof value !== 'object' || value === null) return false;
	const id: unknown = Reflect.get(value, 'id');
	const label: unknown = Reflect.get(value, 'label');
	const href: unknown = Reflect.get(value, 'href');
	const scope: unknown = Reflect.get(value, 'scope');
	return (
		typeof id === 'string' &&
		typeof label === 'string' &&
		typeof href === 'string' &&
		(scope === null || SCOPE_IDS.has(scope))
	);
}

export function readPaletteRecents(): PaletteRecent[] {
	try {
		const stored: unknown = JSON.parse(
			localStorage.getItem(RECENTS_STORAGE_KEY) ?? '[]'
		);
		return Array.isArray(stored)
			? stored.filter(isPaletteRecent).slice(0, RECENT_LIMIT)
			: [];
	} catch {
		return [];
	}
}

export function rememberPaletteRecent(entry: PaletteRecent): PaletteRecent[] {
	const next = [
		entry,
		...readPaletteRecents().filter((recent) => recent.href !== entry.href),
	].slice(0, RECENT_LIMIT);
	try {
		localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(next));
	} catch {
		return next;
	}
	return next;
}
