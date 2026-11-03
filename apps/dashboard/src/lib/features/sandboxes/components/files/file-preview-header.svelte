<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
function neighborPaths(filePaths: readonly string[], path: string) {
	const fileIndex = filePaths.indexOf(path);
	if (fileIndex < 0) return { nextPath: null, previousPath: null };
	return {
		nextPath: filePaths[fileIndex + 1] ?? null,
		previousPath: filePaths[fileIndex - 1] ?? null,
	};
}
</script>

<script lang="ts">
import ArrowDown from '@lucide/svelte/icons/arrow-down';
import ArrowUp from '@lucide/svelte/icons/arrow-up';
import Check from '@lucide/svelte/icons/check';
import Copy from '@lucide/svelte/icons/copy';
import Download from '@lucide/svelte/icons/download';
import MoreHorizontal from '@lucide/svelte/icons/ellipsis';
import Pencil from '@lucide/svelte/icons/pencil';
import Wrap from '@lucide/svelte/icons/text-wrap';
import type { FilesystemNode } from '#lib/api/sandboxes/files.ts';
import type { IconComponent } from '#lib/components/icons/icon-component.ts';
import NoWrap from '#lib/components/icons/no-wrap.svelte';
import Trash from '#lib/components/icons/trash.svelte';
import { CopyToClipboard } from '#lib/components/ui/clipboard/copy-to-clipboard.svelte.ts';
import DropdownMenu from '#lib/components/ui/dropdown-menu/dropdown-menu.svelte';
import DropdownMenuContent from '#lib/components/ui/dropdown-menu/dropdown-menu-content.svelte';
import DropdownMenuItem from '#lib/components/ui/dropdown-menu/dropdown-menu-item.svelte';
import DropdownMenuSeparator from '#lib/components/ui/dropdown-menu/dropdown-menu-separator.svelte';
import { MENU_LABEL_CLASS } from '#lib/components/ui/dropdown-menu/dropdown-menu-styles.ts';
import DropdownMenuTrigger from '#lib/components/ui/dropdown-menu/dropdown-menu-trigger.svelte';
import IconButton from '#lib/components/ui/icon-button.svelte';
import OverflowText from '#lib/components/ui/overflow/overflow-text.svelte';
import Tooltip from '#lib/components/ui/tooltip/tooltip.svelte';

interface FilePreviewHeaderProps {
	node: FilesystemNode;
	editable: boolean;
	onRename: () => void;
	onDelete: () => void;
	filePaths?: readonly string[];
	onSelect?: (path: string) => void;
	onDownload?: (node: FilesystemNode) => void;
	textContent?: string | null;
	canWrap?: boolean;
	wrapLines?: boolean;
	onToggleWrap?: () => void;
}

let {
	node,
	editable,
	onRename,
	onDelete,
	filePaths = [],
	onSelect,
	onDownload,
	textContent = null,
	canWrap = false,
	wrapLines = false,
	onToggleWrap,
}: FilePreviewHeaderProps = $props();

const neighbors = $derived(neighborPaths(filePaths, node.path));
const clipboard = new CopyToClipboard();
</script>

{#snippet action(
	label: string,
	icon: IconComponent,
	onclick: () => void,
	disabled = false
)}
	<Tooltip content={label}>
		{#snippet child({
			props,
		})}
			<IconButton
				{...props}
				variant="ghost"
				{label}
				{icon}
				{disabled}
				{onclick}
			/>
		{/snippet}
	</Tooltip>
{/snippet}

<div
	class="flex h-12 shrink-0 items-center justify-between gap-2 border-border border-b px-4"
>
	<div class="flex min-w-0 flex-col">
		<h2 class="min-w-0 truncate text-(--text-primary) text-sm">{node.name}</h2>
		<OverflowText
			text={node.path}
			class="font-mono text-(--text-muted) text-caption"
		/>
	</div>
	<div class="flex shrink-0 items-center gap-0.5">
		{#if textContent !== null}
			{@render action(
				clipboard.copied ? 'Copied!' : 'Copy contents',
				clipboard.copied ? Check : Copy,
				() => void clipboard.copy(textContent ?? '')
			)}
		{/if}
		{#if textContent !== null && canWrap && onToggleWrap}
			{@render action(
				wrapLines ? 'Disable wrap' : 'Wrap lines',
				wrapLines ? NoWrap : Wrap,
				onToggleWrap
			)}
		{/if}
		{#if onDownload}
			{@render action('Download', Download, () => onDownload(node))}
		{/if}
		{#if onSelect}
			{@render action(
				'Previous',
				ArrowUp,
				() => neighbors.previousPath && onSelect(neighbors.previousPath),
				!neighbors.previousPath
			)}
			{@render action(
				'Next',
				ArrowDown,
				() => neighbors.nextPath && onSelect(neighbors.nextPath),
				!neighbors.nextPath
			)}
		{/if}
		<DropdownMenu>
			<DropdownMenuTrigger>
				{#snippet child({
					props,
				})}
					<IconButton
						{...props}
						variant="ghost"
						label={`Actions for ${node.name}`}
						icon={MoreHorizontal}
						disabled={!editable}
					/>
				{/snippet}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onSelect={onRename}>
					<Pencil />
					<span class={MENU_LABEL_CLASS}>Rename</span>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={onDelete}>
					<Trash />
					<span class={MENU_LABEL_CLASS}>Delete</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	</div>
</div>
