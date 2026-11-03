<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import {
	FILE_TREE_EDGE_PADDING,
	FILE_TREE_ROW_HEIGHT,
} from '#lib/features/sandboxes/state/files/filesystem-tree-state.svelte.ts';

const TREE_BODY_STATE = {
	empty: 'empty',
	error: 'error',
	list: 'list',
	loading: 'loading',
} as const;

type TreeBodyState = (typeof TREE_BODY_STATE)[keyof typeof TREE_BODY_STATE];

const DRAG_LINE_TOP_OFFSET_PIXELS = -1;
const DRAG_LINE_LEFT_OFFSET_PIXELS = -8;
const DRAG_LINE_INDENT_PIXELS = 1;

function treeBodyState({
	nodeCount,
	rootLoading,
	searchEnabled,
	searchFailed,
	searchFetching,
}: {
	nodeCount: number;
	rootLoading: boolean;
	searchEnabled: boolean;
	searchFailed: boolean;
	searchFetching: boolean;
}): TreeBodyState {
	if (rootLoading || (searchEnabled && searchFetching && nodeCount === 0)) {
		return TREE_BODY_STATE.loading;
	}
	if (searchFailed) return TREE_BODY_STATE.error;
	return nodeCount === 0 ? TREE_BODY_STATE.empty : TREE_BODY_STATE.list;
}
</script>

<script lang="ts">
import { IsFocusWithin } from 'runed';
import { FILE_SEARCH_MINIMUM_CHARACTERS } from '#lib/api/sandboxes/files.ts';
import Loader from '#lib/components/icons/loader.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import type { FilesystemExplorer } from '#lib/features/sandboxes/state/files/filesystem-explorer.svelte.ts';
import { snapshot } from '$app/navigation';
import FilesystemTreeRow from './filesystem-tree-row.svelte';

interface FilesystemTreeProps {
	explorer: FilesystemExplorer;
	selectedPath: string | null;
}

let { explorer, selectedPath }: FilesystemTreeProps = $props();

let container = $state<HTMLDivElement | null>(null);
const focusWithin = new IsFocusWithin(() => container);
const tree = $derived(explorer.tree);
const search = $derived(explorer.search);
const bodyState = $derived(
	treeBodyState({
		nodeCount: explorer.nodes.length,
		rootLoading: tree.rootLoading,
		searchEnabled: search.enabled,
		searchFailed: search.query.isError,
		searchFetching: search.query.isFetching,
	})
);
const listHeight = $derived(
	`${explorer.totalSize + FILE_TREE_EDGE_PADDING * 2}px`
);
const dragLineLeft = $derived(
	tree.drag.line
		? tree.drag.line.level * DRAG_LINE_INDENT_PIXELS +
				DRAG_LINE_LEFT_OFFSET_PIXELS
		: 0
);

snapshot({
	capture: () => tree.captureExpanded(),
	restore: (paths: string[]) => tree.restoreExpanded(paths),
});

const handleContainerFocus = (
	event: FocusEvent & { currentTarget: HTMLDivElement }
) => {
	if (event.target !== event.currentTarget || search.enabled) return;
	tree.keyboard.focusTree();
};
</script>

<svelte:window ondragend={tree.drag.end} />

{#snippet virtualRows()}
	{#each explorer.rows as virtualRow (explorer.nodes[virtualRow.index]?.path ??
		virtualRow.key)}
		{const node = $derived(explorer.nodes[virtualRow.index])}
		{#if node}
			<FilesystemTreeRow
				entry={search.enabled ? undefined : tree.rows[virtualRow.index]}
				{node}
				onSelectSearchResult={() => explorer.select(node.path)}
				rowSize={virtualRow.size}
				rowStart={virtualRow.start}
				selected={selectedPath === node.path}
				{tree}
			/>
		{/if}
	{/each}
{/snippet}

{#snippet treeMessage(
	state: Exclude<TreeBodyState, typeof TREE_BODY_STATE.list>
)}
	{#if state === TREE_BODY_STATE.loading}
		<div class="flex h-20 items-center justify-center text-(--text-muted)">
			<Loader class="size-4 animate-spin" />
		</div>
	{:else if state === TREE_BODY_STATE.error}
		<p class="px-4 py-3 text-(--text-error) text-small">Search failed</p>
	{:else}
		<p class="px-4 py-3 text-(--text-muted) text-small">
			{search.enabled ? 'No results' : 'Empty folder'}
		</p>
	{/if}
{/snippet}

<div class="flex h-full min-h-0 flex-col border-border border-r bg-bg">
	{#if search.tooShort}
		<p
			class="border-border border-b px-4 py-2 text-(--text-muted) text-caption"
		>
			Type at least {FILE_SEARCH_MINIMUM_CHARACTERS} characters
		</p>
	{/if}
	{#if tree.failedDirectoryPath}
		{const failedPath = $derived(tree.failedDirectoryPath)}
		<div
			role="alert"
			class="flex items-center gap-2 border-border border-b py-1 pr-2 pl-4 text-(--text-error) text-caption"
		>
			<span class="min-w-0 flex-1 truncate">Could not load {failedPath}</span>
			<Chip onclick={() => void explorer.refreshPath(failedPath)}>
				Try again
			</Chip>
		</div>
	{/if}
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<!-- biome-ignore lint/a11y/noStaticElementInteractions: roving-tabindex entry point for the virtualized tree; onfocus only forwards focus to the current treeitem and is not a user interaction -->
	<div
		bind:this={container}
		class="min-h-0 flex-1 outline-none focus-visible:ring-1 focus-visible:ring-(--brand-accent)"
		tabindex={focusWithin.current ? -1 : 0}
		onfocus={handleContainerFocus}
	>
		<div
			bind:this={explorer.viewport}
			class="h-full overflow-x-hidden overflow-y-auto"
		>
			{#if bodyState === TREE_BODY_STATE.list && search.enabled}
				<div class="relative min-h-full w-full" style:height={listHeight}>
					{@render virtualRows()}
				</div>
			{:else if bodyState === TREE_BODY_STATE.list}
				<!-- svelte-ignore a11y_interactive_supports_focus -->
				<div
					role="tree"
					aria-label="Sandbox filesystem"
					class="relative min-h-full w-full"
					style:height={listHeight}
					onkeydown={tree.keyboard.handleKeydown}
					ondragover={(event) => event.preventDefault()}
					ondrop={tree.drag.dropOnRoot}
				>
					{@render virtualRows()}
					{#if tree.drag.line}
						<div
							class="pointer-events-none absolute border-(--brand-accent) border-t-2"
							style:top={`${tree.drag.line.index * FILE_TREE_ROW_HEIGHT + FILE_TREE_EDGE_PADDING + DRAG_LINE_TOP_OFFSET_PIXELS}px`}
							style:left={`${dragLineLeft}px`}
							style:width={`calc(100% - ${dragLineLeft}px)`}
						></div>
					{/if}
				</div>
			{:else}
				{@render treeMessage(bodyState)}
			{/if}
		</div>
	</div>
</div>
