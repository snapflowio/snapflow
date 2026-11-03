<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { Component, Snippet } from 'svelte';
import type { EventHandler } from 'svelte/elements';
import type { ChipModalProps } from './chip-modal.svelte';

type ChipConfirmTextSegment =
	| string
	| {
			text: string;
			bold?: boolean;
			error?: boolean;
	  }
	| false
	| null
	| undefined;
export type ChipConfirmText = string | readonly ChipConfirmTextSegment[];
function hasChipConfirmText(
	text: ChipConfirmText | Snippet | undefined
): text is ChipConfirmText | Snippet {
	if (text === undefined) return false;
	if (typeof text === 'function') return true;
	if (typeof text === 'string') return text.length > 0;
	return text.some((segment) => {
		if (!segment) return false;
		return typeof segment === 'string'
			? segment.length > 0
			: segment.text.length > 0;
	});
}
interface ChipModalConfirmProps {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	onsubmit?: EventHandler<SubmitEvent, HTMLFormElement>;
	title: string;
	icon?: Component<{ class?: string }> | null;
	text?: ChipConfirmText | Snippet;
	children?: Snippet;
	confirm: Snippet;
	pending?: boolean;
	cancelLabel?: string;
	size?: ChipModalProps['size'];
	srTitle?: string;
}
</script>

<script lang="ts">
import { cn } from '#lib/utils/utils.ts';
import ChipModal from './chip-modal.svelte';
import ChipModalBody from './chip-modal-body.svelte';
import ChipModalFooter from './chip-modal-footer.svelte';
import ChipModalHeader from './chip-modal-header.svelte';

let {
	open = $bindable(false),
	onOpenChange,
	onsubmit,
	title,
	icon,
	text,
	children,
	confirm,
	pending = false,
	cancelLabel,
	size = 'sm',
	srTitle,
}: ChipModalConfirmProps = $props();

const descriptionId = $props.id();
const hasText = $derived(hasChipConfirmText(text));
</script>

{#snippet confirmText(
	content: ChipConfirmText | Snippet
)}
	{#if typeof content === 'function'}
		{@render content()}
	{:else if typeof content === 'string'}
		{content}
	{:else}
		{#each content as segment}
			{#if typeof segment === 'string'}
				{segment}
			{:else if segment}
				{#if segment.bold}
					<strong
						class={cn('font-medium', segment.error && 'text-(--text-error)')}
						>{segment.text}</strong
					>
				{:else if segment.error}
					<span class="text-(--text-error)">{segment.text}</span>
				{:else}
					{segment.text}
				{/if}
			{/if}
		{/each}
	{/if}
{/snippet}

<ChipModal
	bind:open
	{onOpenChange}
	{onsubmit}
	{size}
	srTitle={srTitle ?? title}
	dismissDisabled={pending}
	aria-describedby={hasText ? descriptionId : undefined}
>
	<ChipModalHeader {icon}>{title}</ChipModalHeader>
	<ChipModalBody>
		{#if text !== undefined && hasText}
			<p
				id={descriptionId}
				class="wrap-break-word px-2 text-(--text-primary) text-sm"
			>
				{@render confirmText(text)}
			</p>
		{/if}
		{@render children?.()}
	</ChipModalBody>
	<ChipModalFooter
		defaultAction="dismiss"
		primaryAction={confirm}
		{cancelLabel}
	/>
</ChipModal>
