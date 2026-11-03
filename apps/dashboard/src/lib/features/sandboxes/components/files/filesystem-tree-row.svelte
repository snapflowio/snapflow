<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import File from '@lucide/svelte/icons/file';
import type { FilesystemNode } from '#lib/api/sandboxes/files.ts';
import ChevronDown from '#lib/components/icons/chevron-down.svelte';
import ChevronRight from '#lib/components/icons/chevron-right.svelte';
import Folder from '#lib/components/icons/folder.svelte';
import Loader from '#lib/components/icons/loader.svelte';
import type { FilesystemTreeEntry } from '#lib/features/sandboxes/lib/files/filesystem-tree-drop-target.ts';
import type { FilesystemTree } from '#lib/features/sandboxes/state/files/filesystem-tree-state.svelte.ts';
import {
	FILE_TREE_EDGE_PADDING,
	FILE_TREE_INDENT_PIXELS,
} from '#lib/features/sandboxes/state/files/filesystem-tree-state.svelte.ts';
import { formatBytes } from '#lib/utils/format.ts';

interface FilesystemTreeRowProps {
	entry: FilesystemTreeEntry | undefined;
	node: FilesystemNode;
	onSelectSearchResult: () => void;
	rowSize: number;
	rowStart: number;
	selected: boolean;
	tree: FilesystemTree;
}

let {
	entry,
	node,
	onSelectSearchResult,
	rowSize,
	rowStart,
	selected,
	tree,
}: FilesystemTreeRowProps = $props();

const path = $derived(node.path);
const expanded = $derived(entry !== undefined && tree.isExpanded(path));
const loading = $derived(entry !== undefined && tree.isLoading(path));
const focused = $derived(entry !== undefined && tree.keyboard.isFocused(path));
const NodeIcon = $derived(node.isDir ? Folder : File);

let toggle: HTMLSpanElement | null = null;

const handleClick = (event: MouseEvent) => {
	if (
		entry &&
		node.isDir &&
		event.target instanceof Node &&
		toggle?.contains(event.target)
	) {
		event.stopPropagation();
		tree.toggleRow(path);
		return;
	}
	if (entry) tree.activateRow(path);
	else onSelectSearchResult();
};
</script>

<button
	type="button"
	role="treeitem"
	aria-busy={loading || undefined}
	aria-expanded={entry && node.isDir ? expanded : undefined}
	aria-label={entry ? node.name : undefined}
	aria-level={entry ? entry.level + 1 : undefined}
	aria-posinset={entry ? entry.posInSet + 1 : undefined}
	aria-selected={selected}
	aria-setsize={entry?.setSize}
	draggable={entry ? 'true' : undefined}
	tabindex={focused ? 0 : -1}
	onclick={handleClick}
	ondragstart={entry ? () => tree.drag.startRow(path) : undefined}
	ondragenter={entry ? (event) => event.preventDefault() : undefined}
	ondragover={entry ? (event) => tree.drag.overRow(event, path) : undefined}
	ondragleave={entry ? tree.drag.leaveRow : undefined}
	ondrop={entry ? (event) => tree.drag.dropOnRow(event, path) : undefined}
	{@attach entry && tree.keyboard.focusRow(path)}
	class={[
		'absolute left-0 flex w-full items-center gap-1.5 pr-2 text-left text-(--text-body) text-small outline-none hover-hover:bg-surface-hover',
		selected && 'bg-surface-active text-(--text-primary)',
		focused && !selected && 'bg-surface-hover',
		entry && tree.drag.isOver(path) && 'bg-surface-active',
	]}
	style:height={`${rowSize}px`}
	style:padding-left={`${FILE_TREE_EDGE_PADDING + (entry?.level ?? 0) * FILE_TREE_INDENT_PIXELS}px`}
	style:transform={`translateY(${rowStart + FILE_TREE_EDGE_PADDING}px)`}
>
	<span
		bind:this={toggle}
		class="flex size-4 shrink-0 items-center justify-center text-(--text-muted)"
		title={node.isDir
			? `${expanded ? 'Collapse' : 'Expand'} ${node.name}`
			: undefined}
	>
		{#if loading}
			<Loader class="size-3.5 animate-spin" />
		{:else if node.isDir && expanded}
			<ChevronDown />
		{:else if node.isDir}
			<ChevronRight />
		{/if}
	</span>
	<NodeIcon class="size-3.5 shrink-0 text-(--text-icon)" />
	<span class="truncate">{entry ? node.name : node.path}</span>
	{#if entry && !node.isDir}
		<span
			class="ml-auto shrink-0 text-(--text-muted) text-caption tabular-nums"
		>
			{formatBytes(node.size)}
		</span>
	{/if}
</button>
