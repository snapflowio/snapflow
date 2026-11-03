<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Check from '@lucide/svelte/icons/check';
import Copy from '@lucide/svelte/icons/copy';
import type { ClassValue } from 'svelte/elements';
import { CopyToClipboard } from '#lib/components/ui/clipboard/copy-to-clipboard.svelte.ts';
import ScrollArea from '#lib/components/ui/scroll-area.svelte';
import { cn } from '#lib/utils/utils.ts';

interface ErrorDetailsProps {
	class?: ClassValue;
	details: string;
}

let { class: className, details }: ErrorDetailsProps = $props();

const clipboard = new CopyToClipboard();
</script>

<div
	class={cn(
		'rounded-lg border border-border bg-surface-2 text-left',
		className
	)}
>
	<div
		class="flex items-center justify-between border-border border-b px-3 py-1.5"
	>
		<span class="font-mono text-(--text-muted) text-xs">Error details</span>
		<button
			type="button"
			onclick={() => void clipboard.copy(details)}
			class="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-(--text-muted) text-xs transition-colors hover-hover:bg-surface-hover hover-hover:text-(--text-primary)"
			title="Copy error"
		>
			{#if clipboard.copied}
				<Check class="h-3 w-3 text-(--text-success)" />
				<span class="text-(--text-success)">Copied</span>
			{:else if clipboard.copyFailed}
				<span>Copy failed</span>
			{:else}
				<Copy class="h-3 w-3" />
				<span>Copy</span>
			{/if}
		</button>
	</div>
	<ScrollArea aria-label="Error details" class="max-h-36">
		<pre
			class="whitespace-pre-wrap break-all p-3 font-mono text-(--text-muted) text-xs leading-relaxed"
		>{details}</pre>
	</ScrollArea>
</div>
