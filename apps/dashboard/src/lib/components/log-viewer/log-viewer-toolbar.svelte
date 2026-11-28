<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ArrowDownToLine from '@lucide/svelte/icons/arrow-down-to-line';
import ArrowUpToLine from '@lucide/svelte/icons/arrow-up-to-line';
import Check from '@lucide/svelte/icons/check';
import Copy from '@lucide/svelte/icons/copy';
import Download from '@lucide/svelte/icons/download';
import Search from '@lucide/svelte/icons/search';
import WrapText from '@lucide/svelte/icons/wrap-text';
import Badge from '#lib/components/ui/badge.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import IconButton from '#lib/components/ui/icon-button.svelte';
import { formatCount } from '#lib/utils/format.ts';

interface LogViewerToolbarProps {
	query: string;
	matchCount: number;
	errorCount: number;
	warnCount: number;
	wrap: boolean;
	copied: boolean;
	onQueryChange: (query: string) => void;
	onToggleWrap: () => void;
	onCopy: () => void;
	onDownload: () => void;
	onJumpTop: () => void;
	onJumpBottom: () => void;
}

let {
	query,
	matchCount,
	errorCount,
	warnCount,
	wrap,
	copied,
	onQueryChange,
	onToggleWrap,
	onCopy,
	onDownload,
	onJumpTop,
	onJumpBottom,
}: LogViewerToolbarProps = $props();
</script>

<div
	class="flex shrink-0 flex-wrap items-center gap-2 border-border border-b px-4 py-3"
>
	<ChipInput
		icon={Search}
		class="h-8 w-60 rounded-full"
		value={query}
		clearable
		placeholder="Search logs"
		aria-label="Search logs"
		oninput={(event) => onQueryChange(event.currentTarget.value)}
	/>
	{#if query.trim()}
		<span class="text-(--text-muted) text-xs tabular-nums">
			{formatCount(matchCount)}
			{matchCount === 1 ? 'match' : 'matches'}
		</span>
	{/if}
	<div class="ml-auto flex items-center gap-2">
		{#if errorCount > 0}
			<Badge variant="error" size="sm">{formatCount(errorCount)}</Badge>
		{/if}
		{#if warnCount > 0}
			<Badge variant="warning" size="sm">{formatCount(warnCount)}</Badge>
		{/if}
		<IconButton
			size="md"
			label={wrap ? 'Stop wrapping lines' : 'Wrap lines'}
			icon={WrapText}
			aria-pressed={wrap}
			onclick={onToggleWrap}
		/>
		<IconButton
			size="md"
			label="Copy all"
			tooltipContent={copied ? 'Copied' : 'Copy all'}
			icon={copied ? Check : Copy}
			onclick={onCopy}
		/>
		<IconButton
			size="md"
			label="Download"
			icon={Download}
			onclick={onDownload}
		/>
		<IconButton
			size="md"
			label="Jump to top"
			icon={ArrowUpToLine}
			onclick={onJumpTop}
		/>
		<IconButton
			size="md"
			label="Jump to bottom"
			icon={ArrowDownToLine}
			onclick={onJumpBottom}
		/>
	</div>
</div>
