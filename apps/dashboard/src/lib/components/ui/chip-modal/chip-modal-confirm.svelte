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
export type ChipConfirmFriction = 'none' | 'acknowledge' | 'type-name';

const ACKNOWLEDGE_LABEL = "I understand this can't be undone";
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
	confirm: Snippet<[ready: boolean]>;
	pending?: boolean;
	friction?: ChipConfirmFriction;
	confirmName?: string;
	error?: string | null;
	cancelLabel?: string;
	size?: ChipModalProps['size'];
	srTitle?: string;
}
</script>

<script lang="ts">
import LabeledCheckbox from '#lib/components/ui/checkbox/labeled-checkbox.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import { cn } from '#lib/utils/utils.ts';
import ChipModal from './chip-modal.svelte';
import ChipModalBody from './chip-modal-body.svelte';
import ChipModalError from './chip-modal-error.svelte';
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
	friction = 'none',
	confirmName,
	error: errorMessage,
	cancelLabel,
	size = 'sm',
	srTitle,
}: ChipModalConfirmProps = $props();

const descriptionId = $props.id();
const nameInputId = `${descriptionId}-name`;
const hasText = $derived(hasChipConfirmText(text));
let acknowledged = $state(false);
let typedName = $state('');
const ready = $derived.by(() => {
	if (friction === 'acknowledge') return acknowledged;
	if (friction === 'type-name') return typedName.trim() === confirmName;
	return true;
});

$effect(() => {
	if (!open) return;
	acknowledged = false;
	typedName = '';
});
</script>

{#snippet confirmText(content: ChipConfirmText | Snippet)}
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
	<ChipModalHeader />
	<ChipModalBody class="gap-4 p-8">
		<div class="flex items-center gap-3">
			{#if icon}
				{@const Icon = icon}
				<Icon class="size-5 shrink-0 text-(--text-muted)" />
			{/if}
			<h3 class="font-medium text-(--text-primary) text-xl">{title}</h3>
		</div>
		<ChipModalError message={errorMessage} />
		{#if text !== undefined && hasText}
			<p id={descriptionId} class="wrap-break-word text-(--text-muted) text-sm">
				{@render confirmText(text)}
			</p>
		{/if}
		{@render children?.()}
		{#if friction === 'acknowledge'}
			<div class="pt-1">
				<LabeledCheckbox bind:checked={acknowledged}>
					{ACKNOWLEDGE_LABEL}
				</LabeledCheckbox>
			</div>
		{:else if friction === 'type-name' && confirmName}
			<div class="flex flex-col gap-2 pt-1">
				<label for={nameInputId} class="text-(--text-muted) text-sm">
					Type
					<span class="font-mono text-(--text-primary)">{confirmName}</span>
					to confirm
				</label>
				<ChipInput
					id={nameInputId}
					bind:value={typedName}
					autocomplete="off"
					spellcheck={false}
				/>
			</div>
		{/if}
	</ChipModalBody>
	<ChipModalFooter defaultAction="dismiss" variant="confirm" {cancelLabel}>
		{#snippet primaryAction()}
			{@render confirm(ready)}
		{/snippet}
	</ChipModalFooter>
</ChipModal>
