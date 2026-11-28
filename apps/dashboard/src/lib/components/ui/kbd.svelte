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

export type KbdVariant = 'boxed' | 'bare';
export type KbdTone = 'default' | 'inverse';

export interface KbdProps {
	keys: string | readonly string[];
	variant?: KbdVariant;
	tone?: KbdTone;
	class?: ClassValue;
}

const BOXED_KEY_CLASS =
	'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] bg-surface-5 px-1 font-mono text-[11px] leading-none tabular-nums';
const BOXED_TONE_CLASS: Record<KbdTone, string> = {
	default: 'text-(--text-muted)',
	inverse: 'bg-white/15 text-current',
};
const BARE_TONE_CLASS: Record<KbdTone, string> = {
	default: 'text-(--text-muted)',
	inverse: 'text-current opacity-85',
};
</script>

<script lang="ts">
import { formatShortcutKeys } from '#lib/utils/platform.ts';
import { cn } from '#lib/utils/utils.ts';

let {
	keys,
	variant = 'boxed',
	tone = 'default',
	class: className,
}: KbdProps = $props();

const tokens = $derived(
	typeof keys === 'string' ? [keys] : formatShortcutKeys(keys)
);
</script>

{#if variant === 'bare'}
	<kbd
		class={cn(
			'inline-flex items-center gap-0.5 font-mono text-xs leading-none tracking-normal tabular-nums pointer-coarse:hidden',
			BARE_TONE_CLASS[tone],
			className
		)}
	>
		{#each tokens as token, index (index)}
			<span>{token}</span>
		{/each}
	</kbd>
{:else}
	<span
		class={cn(
			'inline-flex items-center gap-0.5 pointer-coarse:hidden',
			className
		)}
	>
		{#each tokens as token, index (index)}
			<kbd class={cn(BOXED_KEY_CLASS, BOXED_TONE_CLASS[tone])}>{token}</kbd>
		{/each}
	</span>
{/if}
