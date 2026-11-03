/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Attachment } from 'svelte/attachments';
import type { FilesystemTreeEntry } from '#lib/features/sandboxes/lib/files/filesystem-tree-drop-target.ts';

const DOM_FOCUS_TIMEOUT_MILLISECONDS = 500;
const UNIDENTIFIED_KEY_CODE = 'Unidentified';

const HOTKEY_MODE = {
	always: 'always',
	dragging: 'dragging',
	idle: 'idle',
} as const;

interface TreeHotkey {
	readonly codes: readonly string[];
	readonly controlShift: boolean;
	readonly mode: (typeof HOTKEY_MODE)[keyof typeof HOTKEY_MODE];
	readonly preventDefault: boolean;
	readonly repeatable: boolean;
	readonly run: (event: KeyboardEvent) => void;
}

export interface FilesystemTreeKeyboardDrag {
	readonly active: boolean;
	start: () => void;
	move: (isUp: boolean) => void;
	complete: (event: KeyboardEvent) => void;
	cancel: () => void;
}

export interface FilesystemTreeKeyboardHost {
	readonly rows: readonly FilesystemTreeEntry[];
	readonly drag: FilesystemTreeKeyboardDrag;
	indexOf: (path: string) => number | undefined;
	isExpanded: (path: string) => boolean;
	expandItem: (path: string) => void;
	collapseItem: (path: string) => void;
	scrollToIndex: (index: number) => void;
}

function resolveKeyCode(event: KeyboardEvent): string {
	return event.code !== '' && event.code !== UNIDENTIFIED_KEY_CODE
		? event.code
		: event.key;
}

function matchesModifiers(event: KeyboardEvent, controlShift: boolean) {
	if (event.altKey || event.metaKey) return false;
	return controlShift
		? event.ctrlKey && event.shiftKey
		: !(event.ctrlKey || event.shiftKey);
}

export class FilesystemTreeKeyboard {
	readonly #host: FilesystemTreeKeyboardHost;
	#focusedPath = $state<string | null>(null);
	#domFocusPath = $state<string | null>(null);
	#domFocusTimer: ReturnType<typeof setTimeout> | undefined;

	readonly #focusedIndex = $derived.by(() => {
		if (this.#focusedPath === null) return this.#host.rows.length > 0 ? 0 : -1;
		return this.#host.indexOf(this.#focusedPath) ?? -1;
	});

	constructor(host: FilesystemTreeKeyboardHost) {
		this.#host = host;
	}

	get focusedEntry(): FilesystemTreeEntry | undefined {
		return this.#host.rows[this.#focusedIndex];
	}

	isFocused = (path: string): boolean =>
		this.#focusedPath === null
			? this.#host.rows[0]?.node.path === path
			: this.#focusedPath === path;

	setFocusedPath = (path: string): void => {
		this.#focusedPath = path;
	};

	focusPath = (path: string): void => {
		this.#focusedPath = path;
		const index = this.#host.indexOf(path);
		if (index !== undefined) this.#host.scrollToIndex(index);
		this.#requestDomFocus();
	};

	focusTree = (): void => {
		const path = this.focusedEntry?.node.path ?? this.#host.rows[0]?.node.path;
		if (path !== undefined) this.focusPath(path);
	};

	focusRow =
		(path: string): Attachment<HTMLElement> =>
		(element) => {
			if (this.#domFocusPath !== path) return;
			element.focus();
			this.#domFocusPath = null;
			clearTimeout(this.#domFocusTimer);
		};

	handleKeydown = (event: KeyboardEvent): void => {
		const code = resolveKeyCode(event);
		const hotkey = this.#hotkeys.find(
			(candidate) =>
				candidate.codes.includes(code) &&
				matchesModifiers(event, candidate.controlShift) &&
				this.#isHotkeyModeActive(candidate.mode)
		);
		if (!hotkey || (event.repeat && !hotkey.repeatable)) return;
		if (hotkey.preventDefault) event.preventDefault();
		hotkey.run(event);
	};

	readonly #hotkeys: readonly TreeHotkey[] = [
		{
			codes: ['ArrowDown'],
			controlShift: false,
			mode: HOTKEY_MODE.idle,
			preventDefault: true,
			repeatable: true,
			run: () => this.#focusRowAt(this.#focusedIndex + 1),
		},
		{
			codes: ['ArrowUp'],
			controlShift: false,
			mode: HOTKEY_MODE.idle,
			preventDefault: true,
			repeatable: true,
			run: () => this.#focusRowAt(this.#focusedIndex - 1),
		},
		{
			codes: ['ArrowRight'],
			controlShift: false,
			mode: HOTKEY_MODE.always,
			preventDefault: false,
			repeatable: true,
			run: () => this.#expandOrDown(),
		},
		{
			codes: ['ArrowLeft'],
			controlShift: false,
			mode: HOTKEY_MODE.always,
			preventDefault: false,
			repeatable: true,
			run: () => this.#collapseOrUp(),
		},
		{
			codes: ['Home'],
			controlShift: false,
			mode: HOTKEY_MODE.always,
			preventDefault: false,
			repeatable: false,
			run: () => this.#focusRowAt(0),
		},
		{
			codes: ['End'],
			controlShift: false,
			mode: HOTKEY_MODE.always,
			preventDefault: false,
			repeatable: false,
			run: () => this.#focusRowAt(this.#host.rows.length - 1),
		},
		{
			codes: ['KeyD'],
			controlShift: true,
			mode: HOTKEY_MODE.idle,
			preventDefault: true,
			repeatable: false,
			run: () => this.#host.drag.start(),
		},
		{
			codes: ['ArrowUp'],
			controlShift: false,
			mode: HOTKEY_MODE.dragging,
			preventDefault: true,
			repeatable: false,
			run: () => this.#host.drag.move(true),
		},
		{
			codes: ['ArrowDown'],
			controlShift: false,
			mode: HOTKEY_MODE.dragging,
			preventDefault: true,
			repeatable: false,
			run: () => this.#host.drag.move(false),
		},
		{
			codes: ['Escape'],
			controlShift: false,
			mode: HOTKEY_MODE.dragging,
			preventDefault: false,
			repeatable: false,
			run: () => this.#host.drag.cancel(),
		},
		{
			codes: ['Enter', 'NumpadEnter'],
			controlShift: false,
			mode: HOTKEY_MODE.dragging,
			preventDefault: true,
			repeatable: false,
			run: (event) => this.#host.drag.complete(event),
		},
	];

	#isHotkeyModeActive(mode: TreeHotkey['mode']): boolean {
		if (mode === HOTKEY_MODE.always) return true;
		return this.#host.drag.active === (mode === HOTKEY_MODE.dragging);
	}

	#requestDomFocus(): void {
		this.#domFocusPath = this.focusedEntry?.node.path ?? this.#focusedPath;
		clearTimeout(this.#domFocusTimer);
		this.#domFocusTimer = setTimeout(() => {
			if (this.#domFocusPath === null) return;
			const first = this.#host.rows[0]?.node.path ?? null;
			this.#focusedPath = first;
			this.#domFocusPath = first;
		}, DOM_FOCUS_TIMEOUT_MILLISECONDS);
	}

	#focusRowAt(index: number): void {
		const { rows } = this.#host;
		const row = rows[Math.max(0, Math.min(index, rows.length - 1))];
		if (row) this.focusPath(row.node.path);
	}

	#expandOrDown(): void {
		const entry = this.focusedEntry;
		if (entry?.node.isDir && !this.#host.isExpanded(entry.node.path)) {
			this.#host.expandItem(entry.node.path);
			return;
		}
		this.#focusRowAt(this.#focusedIndex + 1);
	}

	#collapseOrUp(): void {
		const entry = this.focusedEntry;
		if (!entry) return;
		const { node } = entry;
		const collapsible = node.isDir && this.#host.isExpanded(node.path);
		if (!collapsible && entry.level !== 0 && entry.parentPath !== null) {
			this.focusPath(entry.parentPath);
			return;
		}
		this.#host.collapseItem(node.path);
	}
}
