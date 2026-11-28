/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	getFilesystemName,
	getFilesystemParentPath,
	joinFilesystemPath,
	ROOT_PATH,
} from '#lib/api/sandboxes/files.ts';
import {
	canDropInto,
	type FilesystemDragTarget,
	type FilesystemDragView,
	type FilesystemTreeEntry,
	nextKeyboardDragTarget,
	pointerDragTarget,
} from '#lib/features/sandboxes/lib/files/filesystem-tree-drop-target.ts';

const DRAG_AUTO_EXPAND_DELAY_MILLISECONDS = 800;
const DRAG_LEAVE_SETTLE_MILLISECONDS = 100;

export interface FilesystemTreeDragHost {
	readonly rows: readonly FilesystemTreeEntry[];
	readonly focusedEntry: FilesystemTreeEntry | undefined;
	entry: (path: string) => FilesystemTreeEntry | undefined;
	indexOf: (path: string) => number | undefined;
	isFolder: (path: string) => boolean;
	isExpanded: (path: string) => boolean;
	expandItem: (path: string) => void;
	load: (path: string) => Promise<void>;
	focusPath: (path: string) => void;
	setFocusedPath: (path: string) => void;
	scrollToIndex: (index: number) => void;
	move: (source: string, destination: string) => Promise<void>;
}

interface DragState {
	readonly draggedPaths: readonly string[];
	readonly overPath?: string;
	readonly target?: FilesystemDragTarget;
}

export interface FilesystemDragLine {
	readonly index: number;
	readonly level: number;
}

export class FilesystemTreeDrag {
	readonly #host: FilesystemTreeDragHost;
	#drag = $state.raw<DragState | null>(null);
	#autoExpandTimer: ReturnType<typeof setTimeout> | undefined;
	#lastDragPath: string | null = null;
	#lastAllowDrop = false;
	#lastDragEnter = 0;

	readonly line: FilesystemDragLine | null = $derived.by(() => {
		const target = this.#drag?.target;
		if (target?.kind !== 'between') return null;
		const { rows } = this.#host;
		const anchored = rows[target.lineIndex] ?? rows[target.lineIndex - 1];
		return anchored
			? { index: target.lineIndex, level: target.lineLevel }
			: null;
	});

	constructor(host: FilesystemTreeDragHost) {
		this.#host = host;
	}

	get active(): boolean {
		return this.#drag !== null;
	}

	isOver = (path: string): boolean => this.#drag?.overPath === path;

	startRow = (path: string): void => {
		const overPath = this.#host.focusedEntry?.node.path;
		this.#drag =
			overPath === undefined
				? { draggedPaths: [path] }
				: { draggedPaths: [path], overPath };
	};

	overRow = (event: DragEvent, path: string): void => {
		event.stopPropagation();
		if (path === this.#lastDragPath) {
			if (this.#lastAllowDrop) event.preventDefault();
			return;
		}
		this.#lastDragPath = path;
		this.#lastDragEnter = Date.now();
		this.#scheduleAutoExpand(path);

		const drag = this.#drag;
		const target = drag
			? pointerDragTarget(
					this.#view(drag.draggedPaths),
					path,
					drag.draggedPaths
				)
			: undefined;
		this.#lastAllowDrop = Boolean(
			drag && target && this.#canDrop(target.path, drag.draggedPaths)
		);
		if (!(drag && target && this.#lastAllowDrop)) return;
		this.#drag = { draggedPaths: drag.draggedPaths, overPath: path, target };
		event.preventDefault();
	};

	leaveRow = (): void => {
		setTimeout(() => {
			if (this.#lastDragEnter + DRAG_LEAVE_SETTLE_MILLISECONDS >= Date.now()) {
				return;
			}
			this.#lastDragPath = null;
			const drag = this.#drag;
			if (drag) this.#drag = { draggedPaths: drag.draggedPaths };
		}, DRAG_LEAVE_SETTLE_MILLISECONDS);
	};

	dropOnRow = (event: DragEvent, path: string): void => {
		event.stopPropagation();
		const drag = this.#drag;
		this.#drag = null;
		if (!drag) return;
		const target = pointerDragTarget(
			this.#view(drag.draggedPaths),
			path,
			drag.draggedPaths
		);
		if (!this.#canDrop(target.path, drag.draggedPaths)) return;
		event.preventDefault();
		this.#lastDragPath = null;
		void this.#dropAndRefocus(drag.draggedPaths, target.path);
	};

	dropOnRoot = (event: DragEvent): void => {
		const drag = this.#drag;
		if (!(drag && this.#canDrop(ROOT_PATH, drag.draggedPaths))) return;
		event.preventDefault();
		this.#lastDragPath = null;
		void this.#move(drag.draggedPaths, ROOT_PATH);
	};

	end = (): void => {
		this.#drag = null;
	};

	startKeyboard = (): void => {
		const focused = this.#host.focusedEntry;
		if (!focused) return;
		const draggedPaths = [focused.node.path];
		this.#drag = { draggedPaths };
		const target = nextKeyboardDragTarget(
			this.#view(draggedPaths),
			{ kind: 'item', path: focused.node.path },
			false
		);
		if (!target) return;
		this.#drag = { draggedPaths, target };
		this.#scrollToTarget(target);
	};

	moveKeyboard = (isUp: boolean): void => {
		const drag = this.#drag;
		if (!drag?.target) return;
		const target = nextKeyboardDragTarget(
			this.#view(drag.draggedPaths),
			drag.target,
			isUp
		);
		if (!target) return;
		this.#drag = { draggedPaths: drag.draggedPaths, target };
		if (target.kind === 'item') this.#host.setFocusedPath(target.path);
		this.#scrollToTarget(target);
	};

	completeKeyboard = (event: KeyboardEvent): void => {
		event.stopPropagation();
		const drag = this.#drag;
		const target = drag?.target;
		if (!(drag && target && this.#canDrop(target.path, drag.draggedPaths))) {
			return;
		}
		this.#lastDragPath = null;
		this.#drag = null;
		void this.#dropAndRefocus(drag.draggedPaths, target.path);
	};

	#canDrop(folderPath: string, draggedPaths: readonly string[]): boolean {
		return canDropInto(
			folderPath,
			this.#host.isFolder(folderPath),
			draggedPaths
		);
	}

	#view(draggedPaths: readonly string[]): FilesystemDragView {
		return {
			canDrop: (folderPath) => this.#canDrop(folderPath, draggedPaths),
			entry: this.#host.entry,
			isExpanded: this.#host.isExpanded,
			rows: this.#host.rows,
		};
	}

	#scheduleAutoExpand(path: string): void {
		if (!this.#host.isFolder(path) || this.#host.isExpanded(path)) return;
		clearTimeout(this.#autoExpandTimer);
		this.#autoExpandTimer = setTimeout(() => {
			if (path === this.#lastDragPath && this.#lastAllowDrop) {
				this.#host.expandItem(path);
			}
		}, DRAG_AUTO_EXPAND_DELAY_MILLISECONDS);
	}

	#scrollToTarget(target: FilesystemDragTarget): void {
		if (target.kind !== 'item') return;
		const index = this.#host.indexOf(target.path);
		if (index !== undefined) this.#host.scrollToIndex(index);
	}

	async #dropAndRefocus(
		draggedPaths: readonly string[],
		destinationDirectory: string
	): Promise<void> {
		if (!(await this.#move(draggedPaths, destinationDirectory))) return;
		const [first] = draggedPaths;
		if (first !== undefined) this.#host.focusPath(first);
	}

	async #move(
		draggedPaths: readonly string[],
		destinationDirectory: string
	): Promise<boolean> {
		try {
			await Promise.all(
				draggedPaths.map((source) =>
					this.#host.move(
						source,
						joinFilesystemPath(destinationDirectory, getFilesystemName(source))
					)
				)
			);
		} catch {
			return false;
		}
		if (!this.#host.isExpanded(destinationDirectory)) {
			this.#host.expandItem(destinationDirectory);
		}
		const sourceParents = new Set(draggedPaths.map(getFilesystemParentPath));
		await Promise.all(
			[destinationDirectory, ...sourceParents].map(this.#host.load)
		);
		return true;
	}
}
