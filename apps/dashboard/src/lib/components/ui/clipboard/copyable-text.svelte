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
import { middleTruncate } from '#lib/components/ui/overflow/middle-truncate.ts';
import { cn } from '#lib/utils/utils.ts';
import { CopyToClipboard } from './copy-to-clipboard.svelte.ts';

interface CopyableTextProps {
	value: string;
	display?: string;
	label?: string;
	head?: number;
	tail?: number;
	mono?: boolean;
	class?: ClassValue;
}

let {
	value,
	display,
	label = 'Copy',
	head,
	tail,
	mono = true,
	class: className,
}: CopyableTextProps = $props();

const clipboard = new CopyToClipboard();
const shown = $derived(display ?? value);
</script>

<span
	class={cn(
		'group/copy relative flex min-w-0 items-center pr-7 text-(--text-primary) text-sm',
		mono && 'font-mono text-xs',
		className
	)}
>
	<span
		class="block min-w-0 flex-1 overflow-hidden whitespace-nowrap"
		{@attach middleTruncate({ text: shown, head, tail })}
	></span>
	<button
		type="button"
		aria-label={clipboard.label(label)}
		class={cn(
			'absolute top-1/2 right-0 inline-flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-(--text-subtle) opacity-0 outline-none transition-opacity duration-(--motion-quick) hover-hover:text-(--text-primary) focus-visible:opacity-100 focus-visible:focus-ring-inset group-hover/copy:opacity-100 group-has-focus-visible/copy:opacity-100 pointer-coarse:opacity-100',
			clipboard.copied && 'opacity-100'
		)}
		onclick={(event) => {
			event.stopPropagation();
			void clipboard.copy(value);
		}}
	>
		{#if clipboard.copied}
			<Check class="size-3.5" />
		{:else}
			<Copy class="size-3.5" />
		{/if}
	</button>
</span>
