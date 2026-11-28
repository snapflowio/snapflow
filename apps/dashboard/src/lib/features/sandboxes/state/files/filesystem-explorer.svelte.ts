/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type CreateQueryResult,
	createQueries,
	createQuery,
} from '@tanstack/svelte-query';
import {
	FILE_SEARCH_MINIMUM_CHARACTERS,
	type FilesystemNode,
	fileDetailsQueryOptions,
	fileSearchQueryOptions,
	toFallbackFilesystemNode,
} from '#lib/api/sandboxes/files.ts';
import type { SandboxToolboxClient } from '#lib/api/sandboxes/toolbox.ts';
import { VirtualList } from '#lib/components/ui/virtual-list.svelte.ts';
import {
	FILE_TREE_OVERSCAN,
	FILE_TREE_ROW_HEIGHT,
	FilesystemTree,
} from './filesystem-tree-state.svelte.ts';

const SCROLL_ALIGNMENT = 'auto';

const estimateRowSize = () => FILE_TREE_ROW_HEIGHT;

type SearchNodeDetails = readonly (FilesystemNode | undefined)[];

function combineNodeDetails(
	results: readonly { data: FilesystemNode | undefined }[]
): SearchNodeDetails {
	return results.map((result) => result.data);
}

export class FilesystemSearch {
	value = $state('');
	readonly #client: () => SandboxToolboxClient;
	readonly query: CreateQueryResult<string[]>;
	readonly enabled = $derived(
		this.value.trim().length >= FILE_SEARCH_MINIMUM_CHARACTERS
	);
	readonly tooShort = $derived(
		this.value.length > 0 && this.value.length < FILE_SEARCH_MINIMUM_CHARACTERS
	);
	readonly #paths = $derived.by(() => this.query.data ?? []);
	readonly #nodeDetails: SearchNodeDetails;
	readonly nodes: readonly FilesystemNode[] = $derived.by(() =>
		this.#paths.map(
			(path, index) =>
				this.#nodeDetails[index] ?? toFallbackFilesystemNode(path)
		)
	);

	constructor(client: () => SandboxToolboxClient) {
		this.#client = client;
		this.query = createQuery(() =>
			fileSearchQueryOptions(this.#client(), this.value)
		);
		this.#nodeDetails = createQueries(() => ({
			queries: (this.enabled ? this.#paths : []).map((path) =>
				fileDetailsQueryOptions(this.#client(), path)
			),
			combine: combineNodeDetails,
		}));
	}
}

export interface FilesystemExplorerOptions {
	client: SandboxToolboxClient;
	onMove: (source: string, destination: string) => Promise<void>;
	onSelect: (path: string, visibleFilePaths: readonly string[]) => void;
}

export class FilesystemExplorer {
	viewport = $state<HTMLDivElement | null>(null);
	readonly #options: () => FilesystemExplorerOptions;
	readonly search: FilesystemSearch;
	readonly tree: FilesystemTree;
	readonly #list: VirtualList;
	readonly nodes: readonly FilesystemNode[] = $derived.by(() =>
		this.search.enabled
			? this.search.nodes
			: this.tree.rows.map((entry) => entry.node)
	);
	readonly #filePaths = $derived(
		this.nodes.filter((node) => !node.isDir).map((node) => node.path)
	);

	constructor(options: () => FilesystemExplorerOptions) {
		this.#options = options;
		this.search = new FilesystemSearch(() => this.#options().client);
		this.tree = new FilesystemTree(() => ({
			client: this.#options().client,
			onMove: this.#options().onMove,
			onPrimaryAction: this.select,
			scrollToIndex: this.#scrollToIndex,
		}));
		this.#list = new VirtualList(() => ({
			count: this.nodes.length,
			estimateSize: estimateRowSize,
			overscan: FILE_TREE_OVERSCAN,
			scrollElement: this.viewport,
		}));
	}

	get rows() {
		return this.#list.items;
	}

	get totalSize(): number {
		return this.#list.totalSize;
	}

	select = (path: string): void => {
		this.#options().onSelect(path, this.#filePaths);
	};

	refreshPath = (path: string): Promise<void> => this.tree.refreshPath(path);

	expandPathAncestors = (path: string): Promise<void> =>
		this.tree.expandPathAncestors(path);

	revealPath = (path: string): void => {
		const index = this.nodes.findIndex((node) => node.path === path);
		if (index >= 0) this.#scrollToIndex(index);
		if (!this.search.enabled) this.tree.keyboard.focusPath(path);
	};

	#scrollToIndex = (index: number): void => {
		this.#list.scrollToIndex(index, { align: SCROLL_ALIGNMENT });
	};
}
