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
import type { ClassValue, EventHandler } from 'svelte/elements';
import type { ModalSize } from '#lib/components/ui/modal/modal-content.svelte';
import type { ChipModalVariant } from './chip-modal-variant.ts';

const PRIMARY_ACTION_SELECTOR =
	'[data-chip-modal-primary] :is(button, a):not(:disabled, [aria-disabled="true"])';
const ENTER_EXCLUDED_SELECTOR =
	'[role="combobox"], [role="menu"], [role="listbox"], [data-enter-ignore]';
const MODAL_SURFACE_CLASS =
	"relative isolate flex min-h-0 flex-col gap-y-1 before:absolute before:inset-x-0 before:top-0 before:bottom-0 before:-z-10 before:rounded-[20px] before:bg-surface-1 before:content-[''] has-[>[data-chip-modal-header]]:before:top-10";
const SHEET_SURFACE_CLASS = 'flex min-h-0 flex-1 flex-col overflow-hidden';
const SHEET_FRAME_CLASS =
	'flex h-full min-h-0 w-full flex-col text-(--text-primary) text-sm';

export interface ChipModalProps {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	onsubmit?: EventHandler<SubmitEvent, HTMLFormElement>;
	onOpenAutoFocus?: (event: Event) => void;
	srTitle?: string;
	'aria-describedby'?: string;
	size?: ModalSize;
	variant?: ChipModalVariant;
	class?: ClassValue;
	dismissDisabled?: boolean;
	hasUnsavedInput?: boolean;
	children?: Snippet;
}
</script>

<script lang="ts">
import { on } from 'svelte/events';
import { DOUBLE_FRAME_OUTER_CLASS } from '#lib/components/ui/chip/chip-chrome.ts';
import Modal from '#lib/components/ui/modal/modal.svelte';
import ModalContent from '#lib/components/ui/modal/modal-content.svelte';
import { cn } from '#lib/utils/utils.ts';
import { ChipModalFocus, setChipModalFocus } from './chip-modal-focus.ts';
import {
	ChipModalGuard,
	setChipModalGuard,
} from './chip-modal-guard.svelte.ts';
import { setChipModalVariant } from './chip-modal-variant.ts';

let {
	open = $bindable(false),
	onOpenChange,
	onsubmit,
	onOpenAutoFocus,
	srTitle = 'Dialog',
	size = 'md',
	variant = 'dialog',
	class: className,
	dismissDisabled = false,
	hasUnsavedInput = false,
	children,
	'aria-describedby': ariaDescribedBy,
}: ChipModalProps = $props();

const focus = setChipModalFocus(new ChipModalFocus());
const guard = setChipModalGuard(new ChipModalGuard(() => hasUnsavedInput));
setChipModalVariant(() => variant);
const isSheet = $derived(variant === 'sheet');

const frameClass = $derived(
	isSheet
		? cn(SHEET_FRAME_CLASS, className)
		: cn(
				'flex min-h-0 w-full flex-col text-(--text-primary) text-sm shadow-(--shadow-raised)',
				DOUBLE_FRAME_OUTER_CLASS,
				className
			)
);

function handleKeydown(event: KeyboardEvent): void {
	if (
		event.key !== 'Enter' ||
		event.isComposing ||
		event.defaultPrevented ||
		event.shiftKey ||
		event.altKey ||
		event.metaKey ||
		event.ctrlKey
	) {
		return;
	}
	const { target } = event;
	if (
		!(target instanceof HTMLInputElement) ||
		target.closest(ENTER_EXCLUDED_SELECTOR)
	) {
		return;
	}
	const frame = event.currentTarget;
	if (!(frame instanceof HTMLElement)) return;
	const primary = frame.querySelector<HTMLElement>(PRIMARY_ACTION_SELECTOR);
	if (!primary) return;
	event.preventDefault();
	primary.click();
}

function handleSubmit(
	event: SubmitEvent & { currentTarget: EventTarget & HTMLFormElement }
): void {
	event.preventDefault();
	onsubmit?.(event);
}
</script>

{#snippet surface()}
	<div class={isSheet ? SHEET_SURFACE_CLASS : MODAL_SURFACE_CLASS}>
		{@render children?.()}
	</div>
{/snippet}

<Modal bind:open {onOpenChange}>
	<ModalContent
		bare={!isSheet}
		placement={isSheet ? 'sheet' : 'center'}
		{srTitle}
		{size}
		{dismissDisabled}
		onOpenAutoFocus={onOpenAutoFocus ?? focus.focusOnOpen}
		onEscapeKeydown={guard.guardEscape}
		onInteractOutside={guard.guardOutside}
		aria-describedby={ariaDescribedBy}
	>
		{#if onsubmit}
			<form class={frameClass} novalidate onsubmit={handleSubmit}>
				{@render surface()}
			</form>
		{:else}
			<div
				class={frameClass}
				{@attach (element) => on(element, 'keydown', handleKeydown)}
			>
				{@render surface()}
			</div>
		{/if}
	</ModalContent>
</Modal>
