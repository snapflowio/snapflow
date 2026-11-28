<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { ClassValue } from 'svelte/elements';

export type LogViewerStatus = 'ready' | 'waiting' | 'error';

export interface LogViewerProps {
	lines: readonly string[];
	status?: LogViewerStatus;
	errorMessage?: string;
	filename?: string;
	class?: ClassValue;
}

const DEFAULT_FILENAME = 'logs.txt';
const LINE_SEPARATOR = '\n';
const LEVEL_CLASS = {
	error: 'border-l-2 border-(--destructive) bg-(--destructive)/15',
	warn: 'border-l-2 border-(--warning) bg-(--warning)/10',
	info: 'border-l-2 border-transparent',
} as const;
</script>

<script lang="ts">
import { CopyToClipboard } from '#lib/components/ui/clipboard/copy-to-clipboard.svelte.ts';
import { downloadFile } from '#lib/utils/download-file.ts';
import { cn } from '#lib/utils/utils.ts';
import { countLevel, filterLogLines, parseLogLines } from './log-line.ts';
import LogViewerToolbar from './log-viewer-toolbar.svelte';

let {
	lines,
	status = 'ready',
	errorMessage,
	filename = DEFAULT_FILENAME,
	class: className,
}: LogViewerProps = $props();

let query = $state('');
let wrap = $state(false);
let body = $state<HTMLDivElement | null>(null);
const clipboard = new CopyToClipboard();

const parsed = $derived(parseLogLines(lines));
const visible = $derived(filterLogLines(parsed, query));
const errorCount = $derived(countLevel(parsed, 'error'));
const warnCount = $derived(countLevel(parsed, 'warn'));
const allText = $derived(lines.join(LINE_SEPARATOR));
const trimmedQuery = $derived(query.trim());

function jumpTo(position: 'top' | 'bottom'): void {
	if (!body) return;
	body.scrollTop = position === 'top' ? 0 : body.scrollHeight;
}
</script>

<div
	class={cn(
		'flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-surface-3',
		className
	)}
>
	<LogViewerToolbar
		{query}
		matchCount={visible.length}
		{errorCount}
		{warnCount}
		{wrap}
		copied={clipboard.copied}
		onQueryChange={(next) => (query = next)}
		onToggleWrap={() => (wrap = !wrap)}
		onCopy={() => void clipboard.copy(allText)}
		onDownload={() => downloadFile(allText, filename)}
		onJumpTop={() => jumpTo('top')}
		onJumpBottom={() => jumpTo('bottom')}
	/>
	<div
		bind:this={body}
		role="log"
		aria-live="polite"
		class="min-h-0 flex-1 overflow-auto py-2 font-mono text-(--text-body) text-xs leading-5"
	>
		{#if status === 'error'}
			<p class="px-3 py-2 text-(--text-error)">
				{`Couldn't load the logs: ${errorMessage ?? 'unknown error'}`}
			</p>
		{:else if status === 'waiting' && parsed.length === 0}
			<p class="px-3 py-2 text-(--text-muted)">Waiting for logs…</p>
		{:else if parsed.length === 0}
			<p class="px-3 py-2 text-(--text-muted)">No logs yet</p>
		{:else if visible.length === 0}
			<p class="px-3 py-2 text-(--text-muted)">
				{`No lines match "${trimmedQuery}"`}
			</p>
		{:else}
			{#each visible as line (line.number)}
				<div
					class={cn(
						'grid grid-cols-[3rem_auto_minmax(0,1fr)] gap-x-2 px-1',
						LEVEL_CLASS[line.level]
					)}
				>
					<span class="select-none text-right text-(--text-muted) tabular-nums"
						>{line.number}</span
					>
					<span aria-hidden="true"></span>
					<span
						class={wrap
							? 'whitespace-pre-wrap break-all'
							: 'overflow-hidden text-clip whitespace-pre'}
						>{line.text}</span
					>
				</div>
			{/each}
		{/if}
	</div>
</div>
