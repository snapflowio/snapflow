/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type FilesystemNode,
	isSameOrDescendantPath,
	ROOT_NODE,
} from '#lib/api/sandboxes/files.ts';

export interface FilesystemTreeEntry {
	readonly index: number;
	readonly level: number;
	readonly node: FilesystemNode;
	readonly parentPath: string | null;
	readonly posInSet: number;
	readonly setSize: number;
}

export type FilesystemDragTarget =
	| { readonly kind: 'item'; readonly path: string }
	| {
			readonly kind: 'between';
			readonly path: string;
			readonly lineIndex: number;
			readonly lineLevel: number;
	  };

export interface FilesystemDragView {
	readonly rows: readonly FilesystemTreeEntry[];
	canDrop: (folderPath: string) => boolean;
	entry: (path: string) => FilesystemTreeEntry | undefined;
	isExpanded: (path: string) => boolean;
}

export const ROOT_ENTRY: FilesystemTreeEntry = {
	index: -1,
	level: -1,
	node: ROOT_NODE,
	parentPath: null,
	posInSet: 0,
	setSize: 1,
};

const DROP_CATEGORY = {
	expandedFolder: 'expanded-folder',
	item: 'item',
	lastInGroup: 'last-in-group',
} as const;

type DropCategory = (typeof DROP_CATEGORY)[keyof typeof DROP_CATEGORY];

function dropCategory(
	view: FilesystemDragView,
	entry: FilesystemTreeEntry
): DropCategory {
	if (view.isExpanded(entry.node.path)) return DROP_CATEGORY.expandedFolder;
	return entry.parentPath !== null && entry.posInSet === entry.setSize - 1
		? DROP_CATEGORY.lastInGroup
		: DROP_CATEGORY.item;
}

function ancestorAtLevel(
	view: FilesystemDragView,
	entry: FilesystemTreeEntry,
	level: number
): FilesystemTreeEntry | undefined {
	let current: FilesystemTreeEntry | undefined = entry;
	while (current && current.level !== level) {
		current =
			current.parentPath === null ? undefined : view.entry(current.parentPath);
	}
	return current;
}

function reparentTarget(
	view: FilesystemDragView,
	entry: FilesystemTreeEntry,
	level: number
): FilesystemDragTarget | undefined {
	const folder = ancestorAtLevel(view, entry, level - 1);
	return folder
		? {
				kind: 'between',
				lineIndex: entry.index + 1,
				lineLevel: level,
				path: folder.node.path,
			}
		: undefined;
}

function stepFromLine(
	view: FilesystemDragView,
	target: Extract<FilesystemDragTarget, { kind: 'between' }>,
	isUp: boolean
): FilesystemDragTarget | undefined {
	const above = view.rows[target.lineIndex - 1];
	if (above && dropCategory(view, above) === DROP_CATEGORY.lastInGroup) {
		const belowLevel = view.rows[above.index + 1]?.level ?? 0;
		const folderHasParent =
			(view.entry(target.path)?.parentPath ?? null) !== null;
		if (isUp && target.lineLevel < above.level) {
			return reparentTarget(view, above, target.lineLevel + 1);
		}
		if (!isUp && target.lineLevel > belowLevel && folderHasParent) {
			return reparentTarget(view, above, target.lineLevel - 1);
		}
	}
	const row = view.rows[target.lineIndex - (isUp ? 1 : 0)];
	return row ? { kind: 'item', path: row.node.path } : undefined;
}

function stepDragTarget(
	view: FilesystemDragView,
	target: FilesystemDragTarget,
	isUp: boolean
): FilesystemDragTarget | undefined {
	if (target.kind === 'between') return stepFromLine(view, target, isUp);
	const entry = view.entry(target.path);
	if (!entry) return undefined;
	if (!isUp && dropCategory(view, entry) === DROP_CATEGORY.expandedFolder) {
		return {
			kind: 'between',
			lineIndex: entry.index + 1,
			lineLevel: entry.level + 1,
			path: entry.node.path,
		};
	}
	if (entry.parentPath === null) return undefined;
	return {
		kind: 'between',
		lineIndex: entry.index + (isUp ? 0 : 1),
		lineLevel: entry.level,
		path: entry.parentPath,
	};
}

export function nextKeyboardDragTarget(
	view: FilesystemDragView,
	from: FilesystemDragTarget,
	isUp: boolean
): FilesystemDragTarget | undefined {
	let candidate = stepDragTarget(view, from, isUp);
	while (candidate && !view.canDrop(candidate.path)) {
		candidate = stepDragTarget(view, candidate, isUp);
	}
	return candidate;
}

export function pointerDragTarget(
	view: FilesystemDragView,
	path: string,
	draggedPaths: readonly string[]
): FilesystemDragTarget {
	const itemTarget: FilesystemDragTarget = { kind: 'item', path };
	if (view.canDrop(path)) return itemTarget;
	const parentPath = view.entry(path)?.parentPath ?? null;
	if (parentPath === null) return itemTarget;
	if (!view.canDrop(parentPath)) {
		return pointerDragTarget(view, parentPath, draggedPaths);
	}
	const draggingFromParent = draggedPaths.some(
		(dragged) =>
			dragged !== parentPath && isSameOrDescendantPath(dragged, parentPath)
	);
	return draggingFromParent ? itemTarget : { kind: 'item', path: parentPath };
}

export function canDropInto(
	folderPath: string,
	isFolder: boolean,
	draggedPaths: readonly string[]
): boolean {
	return (
		isFolder &&
		draggedPaths.every(
			(source) =>
				source !== folderPath && !isSameOrDescendantPath(folderPath, source)
		)
	);
}
