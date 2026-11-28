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

export type AddressForm = 'short' | 'full';
export type AddressKind = 'address' | 'tx';

export interface AddressDisplayProps {
	value: string;
	form?: AddressForm;
	kind?: AddressKind;
	class?: ClassValue;
}

const HEX_PREFIX = '0x';
const HIGHLIGHT_HEX_CHARS = 8;
const SHORT_HEAD_CHARS = 6;
const SHORT_TAIL_CHARS = 4;
const ELLIPSIS = '…';
const EXPLORER_PATHS: Record<AddressKind, string> = {
	address: 'address',
	tx: 'tx',
};

const COPY_LABELS: Record<AddressKind, string> = {
	address: 'Copy address',
	tx: 'Copy transaction hash',
};

function splitAddress(value: string): {
	head: string;
	middle: string;
	tail: string;
} {
	const prefix = value.startsWith(HEX_PREFIX) ? HEX_PREFIX : '';
	const body = value.slice(prefix.length);
	if (body.length <= HIGHLIGHT_HEX_CHARS * 2) {
		return { head: value, middle: '', tail: '' };
	}
	return {
		head: prefix + body.slice(0, HIGHLIGHT_HEX_CHARS),
		middle: body.slice(HIGHLIGHT_HEX_CHARS, -HIGHLIGHT_HEX_CHARS),
		tail: body.slice(-HIGHLIGHT_HEX_CHARS),
	};
}

function shortForm(value: string): string {
	if (value.length <= SHORT_HEAD_CHARS + SHORT_TAIL_CHARS) return value;
	return `${value.slice(0, SHORT_HEAD_CHARS)}${ELLIPSIS}${value.slice(-SHORT_TAIL_CHARS)}`;
}
</script>

<script lang="ts">
import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
import Check from '@lucide/svelte/icons/check';
import Copy from '@lucide/svelte/icons/copy';
import { getPublicConfig } from '#lib/api/public-config.ts';
import { CopyToClipboard } from '#lib/components/ui/clipboard/copy-to-clipboard.svelte.ts';
import Tooltip from '#lib/components/ui/tooltip/tooltip.svelte';
import { settlementChain } from '#lib/integrations/wallet/wallet-networks.ts';
import { cn } from '#lib/utils/utils.ts';

let {
	value,
	form = 'short',
	kind = 'address',
	class: className,
}: AddressDisplayProps = $props();

const { chainId } = getPublicConfig().settlement;
const clipboard = new CopyToClipboard();
const parts = $derived(splitAddress(value));
const explorerHref = $derived.by(() => {
	const explorer = settlementChain(chainId).blockExplorers?.default.url;
	return explorer
		? new URL(`${EXPLORER_PATHS[kind]}/${value}`, `${explorer}/`).href
		: null;
});
const actionClass =
	'inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-(--text-subtle) opacity-0 outline-none transition-opacity duration-(--motion-quick) hover-hover:text-(--text-primary) focus-visible:opacity-100 focus-visible:focus-ring group-hover/address:opacity-100 group-focus-within/address:opacity-100 pointer-coarse:opacity-100';
</script>

<span
	class={cn(
		'group/address inline-flex min-w-0 items-center gap-1 font-mono text-sm',
		className
	)}
>
	{#if form === 'full'}
		<span class="min-w-0 break-all" title={value}>
			<span class="text-(--text-primary)">{parts.head}</span
			><span class="text-(--text-muted)">{parts.middle}</span
			><span class="text-(--text-primary)">{parts.tail}</span>
		</span>
	{:else}
		<span class="truncate text-(--text-secondary)" title={value}>
			{shortForm(value)}
		</span>
	{/if}
	<Tooltip content={clipboard.label(COPY_LABELS[kind])}>
		{#snippet child({ props })}
			<button
				{...props}
				type="button"
				aria-label={COPY_LABELS[kind]}
				class={cn(actionClass, clipboard.copied && 'opacity-100')}
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
		{/snippet}
	</Tooltip>
	{#if explorerHref}
		<Tooltip content="View on explorer">
			{#snippet child({ props })}
				<a
					{...props}
					href={explorerHref}
					target="_blank"
					rel="noopener noreferrer"
					aria-label="View on explorer"
					class={actionClass}
					onclick={(event) => event.stopPropagation()}
				>
					<ArrowUpRight class="size-3.5" />
				</a>
			{/snippet}
		</Tooltip>
	{/if}
</span>
