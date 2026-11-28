<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { Snippet } from 'svelte';
import type { ClassValue } from 'svelte/elements';

export type KeyValueAlign = 'start' | 'end';

export interface KeyValueRowProps {
	label: string | Snippet;
	info?: string;
	value?: string | number | bigint | null | Snippet;
	children?: Snippet;
	mono?: boolean;
	copy?: string | null;
	copyLabel?: string;
	action?: Snippet;
	href?: string;
	align?: KeyValueAlign;
	empty?: string;
	class?: ClassValue;
}

const EMPTY_VALUE = '—';
const HOVER_REVEAL_CLASS =
	'opacity-0 transition-opacity duration-(--motion-quick) group-hover/kv:opacity-100 group-focus-within/kv:opacity-100 pointer-coarse:opacity-100';
</script>

<script lang="ts">
import Check from '@lucide/svelte/icons/check';
import Copy from '@lucide/svelte/icons/copy';
import { CopyToClipboard } from '#lib/components/ui/clipboard/copy-to-clipboard.svelte.ts';
import { cn } from '#lib/utils/utils.ts';
import InfoTooltip from './info-tooltip.svelte';
import { keyValueListScope } from './key-value-list-context.ts';

let {
	label,
	info,
	value,
	children,
	mono = false,
	copy,
	copyLabel = 'Copy',
	action,
	href,
	align = 'start',
	empty = EMPTY_VALUE,
	class: className,
}: KeyValueRowProps = $props();

const scope = keyValueListScope();
const clipboard = new CopyToClipboard();
const termTag = scope ? 'dt' : 'div';
const valueTag = scope ? 'dd' : 'div';
const framed = $derived(scope?.framed ?? false);
const review = $derived(scope?.review ?? false);
const end = $derived(align === 'end' && !review);
const hasValue = $derived(
	value !== undefined && value !== null && value !== ''
);
</script>

{#snippet valueContent()}
	{#if children}
		{@render children()}
	{:else if typeof value === 'function'}
		{@render value()}
	{:else if hasValue}
		{String(value)}
	{:else}
		<span class="text-(--text-subtle)">{empty}</span>
	{/if}
{/snippet}

<div
	data-kv-row=""
	class={cn(
		'group/kv min-w-0 text-sm',
		review
			? 'grid grid-cols-1 gap-y-1 border-border border-t py-2 @sm:grid-cols-[minmax(10rem,2fr)_3fr] @sm:items-baseline @sm:gap-x-4'
			: 'flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between md:gap-4',
		!review && (framed ? 'px-6 py-3' : 'py-0.5 md:min-h-9'),
		className
	)}
>
	<svelte:element
		this={termTag}
		data-kv-label=""
		class={cn(
			'flex min-w-0 items-center gap-1 text-(--text-subtle)',
			review
				? 'wrap-break-word'
				: 'wrap-break-word md:shrink-0 md:grow-0 md:basis-[clamp(9rem,36%,14rem)]'
		)}
	>
		{#if typeof label === 'string'}
			{label}
		{:else}
			{@render label()}
		{/if}
		{#if info}
			<InfoTooltip content={info} />
		{/if}
	</svelte:element>
	<svelte:element
		this={valueTag}
		data-kv-value=""
		class={cn(
			'flex min-w-0 items-center gap-2',
			!review &&
				'flex-1 rounded-md transition-colors duration-75 md:px-2.5 md:py-1',
			!framed && !review && 'md:hover-hover:bg-surface-3',
			end && 'md:justify-end md:text-right'
		)}
	>
		<div
			class={cn(
				'min-w-0 text-(--text-primary) text-sm',
				end && 'tabular-nums',
				mono ? 'truncate font-mono font-normal text-xs' : 'wrap-break-word'
			)}
			title={mono && typeof value === 'string' ? value : undefined}
		>
			{#if href}
				<a
					{href}
					class="underline-offset-4 hover-hover:text-(--text-primary) hover-hover:underline"
				>
					{@render valueContent()}
				</a>
			{:else}
				{@render valueContent()}
			{/if}
		</div>
		{#if copy}
			<button
				type="button"
				aria-label={clipboard.label(copyLabel)}
				class={cn(
					'inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm text-(--text-icon) outline-none hover-hover:text-(--text-primary) focus-visible:focus-ring',
					!clipboard.copied && HOVER_REVEAL_CLASS
				)}
				onclick={() => void clipboard.copy(copy)}
			>
				{#if clipboard.copied}
					<Check class="size-3.5" />
				{:else}
					<Copy class="size-3.5" />
				{/if}
			</button>
		{/if}
		{#if action}
			<div class={cn('shrink-0', HOVER_REVEAL_CLASS)}>{@render action()}</div>
		{/if}
	</svelte:element>
</div>
