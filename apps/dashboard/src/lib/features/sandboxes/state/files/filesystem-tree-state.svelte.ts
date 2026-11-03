/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type QueryClient, useQueryClient } from '@tanstack/svelte-query';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import {
	directoryQueryOptions,
	type FilesystemNode,
	filesystemQueryKeys,
	getFilesystemAncestorPaths,
	getFilesystemParentPath,
	ROOT_PATH,
} from '#lib/api/sandboxes/files.ts';
import type { SandboxToolboxClient } from '#lib/api/sandboxes/toolbox.ts';
import {
	type FilesystemTreeEntry,
	ROOT_ENTRY,
} from '#lib/features/sandboxes/lib/files/filesystem-tree-drop-target.ts';
import { FilesystemTreeDrag } from './filesystem-tree-drag.svelte.ts';
import { FilesystemTreeKeyboard } from './filesystem-tree-keyboard.svelte.ts';

export const FILE_TREE_ROW_HEIGHT = 32;
export const FILE_TREE_OVERSCAN = 12;
export const FILE_TREE_EDGE_PADDING = 8;
export const FILE_TREE_INDENT_PIXELS = 16;

export interface FilesystemTreeOptions {
	client: SandboxToolboxClient;
	onMove: (source: string, destination: string) => Promise<void>;
	onPrimaryAction: (path: string) => void;
	scrollToIndex: (index: number) => void;
}

export class FilesystemTree {
	readonly #options: () => FilesystemTreeOptions;
	readonly #queryClient: QueryClient;
	readonly #children = new SvelteMap<string, readonly FilesystemNode[]>();
	readonly #expanded = new SvelteSet<string>([ROOT_PATH]);
	readonly #loads = new SvelteMap<string, Promise<void>>();
	#failedDirectoryPath = $state<string | null>(null);

	readonly rows: readonly FilesystemTreeEntry[] = $derived.by(() =>
		this.#flatten()
	);
	readonly #entries = $derived(
		new Map(this.rows.map((entry) => [entry.node.path, entry]))
	);
	readonly keyboard: FilesystemTreeKeyboard;
	readonly drag: FilesystemTreeDrag;

	constructor(
		options: () => FilesystemTreeOptions,
		queryClient: QueryClient = useQueryClient()
	) {
		this.#options = options;
		this.#queryClient = queryClient;
		const tree = this;
		this.keyboard = new FilesystemTreeKeyboard({
			get rows() {
				return tree.rows;
			},
			drag: {
				get active() {
					return tree.drag.active;
				},
				start: () => this.drag.startKeyboard(),
				move: (isUp) => this.drag.moveKeyboard(isUp),
				complete: (event) => this.drag.completeKeyboard(event),
				cancel: () => this.drag.end(),
			},
			indexOf: this.#indexOf,
			isExpanded: this.isExpanded,
			expandItem: this.expandItem,
			collapseItem: this.collapseItem,
			scrollToIndex: (index) => this.#options().scrollToIndex(index),
		});
		this.drag = new FilesystemTreeDrag({
			get rows() {
				return tree.rows;
			},
			get focusedEntry() {
				return tree.keyboard.focusedEntry;
			},
			entry: this.#entry,
			indexOf: this.#indexOf,
			isFolder: this.#isFolder,
			isExpanded: this.isExpanded,
			expandItem: this.expandItem,
			load: this.#load,
			focusPath: (path) => this.keyboard.focusPath(path),
			setFocusedPath: (path) => this.keyboard.setFocusedPath(path),
			scrollToIndex: (index) => this.#options().scrollToIndex(index),
			move: (source, destination) =>
				this.#options().onMove(source, destination),
		});
		void this.#load(ROOT_PATH);
	}

	get failedDirectoryPath(): string | null {
		return this.#failedDirectoryPath;
	}

	get rootLoading(): boolean {
		return this.isLoading(ROOT_PATH) && this.rows.length <= 1;
	}

	isExpanded = (path: string): boolean => this.#expanded.has(path);

	isLoading = (path: string): boolean =>
		this.#loads.has(path) && !this.#children.has(path);

	expandItem = (path: string): void => {
		if (!this.#isFolder(path) || this.isLoading(path)) return;
		this.#expanded.add(path);
		if (!this.#children.has(path)) void this.#load(path);
	};

	collapseItem = (path: string): void => {
		if (this.#isFolder(path)) this.#expanded.delete(path);
	};

	collapseAll = (): void => {
		this.#expanded.clear();
		this.#expanded.add(ROOT_PATH);
	};

	toggleRow = (path: string): void => {
		if (this.isExpanded(path)) this.collapseItem(path);
		else this.expandItem(path);
	};

	activateRow = (path: string): void => {
		this.keyboard.setFocusedPath(path);
		this.#options().onPrimaryAction(path);
		this.expandItem(path);
	};

	refreshPath = async (path: string): Promise<void> => {
		await this.#queryClient.invalidateQueries({
			queryKey: filesystemQueryKeys.directory(
				this.#options().client.sandboxId,
				path
			),
		});
		await this.#load(path);
	};

	expandPathAncestors = async (path: string): Promise<void> => {
		for (const ancestorPath of getFilesystemAncestorPaths(
			getFilesystemParentPath(path)
		)) {
			this.expandItem(ancestorPath);
			this.#children.delete(ancestorPath);
			await this.#load(ancestorPath);
		}
	};

	captureExpanded = (): string[] => [...this.#expanded];

	restoreExpanded = (paths: readonly string[]): void => {
		const restored = new Set(paths);
		for (const path of restored) {
			const reachable = getFilesystemAncestorPaths(
				getFilesystemParentPath(path)
			).every((ancestorPath) => restored.has(ancestorPath));
			if (path === ROOT_PATH || !reachable) continue;
			this.#expanded.add(path);
			void this.#load(path).then(() => this.#dropFailedRestore(path));
		}
	};

	#dropFailedRestore(path: string): void {
		if (this.#failedDirectoryPath !== path) return;
		this.#failedDirectoryPath = null;
		this.#expanded.delete(path);
	}

	#flatten(): FilesystemTreeEntry[] {
		const rows: FilesystemTreeEntry[] = [];
		const visit = (parentPath: string, level: number) => {
			const children = this.#children.get(parentPath) ?? [];
			children.forEach((node, posInSet) => {
				rows.push({
					index: rows.length,
					level,
					node,
					parentPath,
					posInSet,
					setSize: children.length,
				});
				if (this.#expanded.has(node.path)) visit(node.path, level + 1);
			});
		};
		visit(ROOT_PATH, 0);
		return rows;
	}

	#indexOf = (path: string): number | undefined =>
		this.#entries.get(path)?.index;

	#entry = (path: string): FilesystemTreeEntry | undefined =>
		path === ROOT_PATH ? ROOT_ENTRY : this.#entries.get(path);

	#isFolder = (path: string): boolean => this.#entry(path)?.node.isDir ?? false;

	#load = (path: string): Promise<void> => {
		const pending = this.#loads.get(path);
		if (pending) return pending;
		const load = this.#fetchChildren(path).finally(() => {
			this.#loads.delete(path);
		});
		this.#loads.set(path, load);
		return load;
	};

	async #fetchChildren(path: string): Promise<void> {
		try {
			const children = await this.#queryClient.query(
				directoryQueryOptions(this.#options().client, path)
			);
			this.#children.set(path, children);
			if (this.#failedDirectoryPath === path) this.#failedDirectoryPath = null;
		} catch {
			this.#failedDirectoryPath = path;
		}
	}
}
