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

const PRIMARY_ACTION_SELECTOR =
	'[data-chip-modal-primary] :is(button, a):not(:disabled, [aria-disabled="true"])';
const ENTER_EXCLUDED_SELECTOR =
	'[role="combobox"], [role="menu"], [role="listbox"], [data-enter-ignore]';

export interface ChipModalProps {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	onsubmit?: EventHandler<SubmitEvent, HTMLFormElement>;
	onOpenAutoFocus?: (event: Event) => void;
	srTitle?: string;
	'aria-describedby'?: string;
	size?: ModalSize;
	class?: ClassValue;
	dismissDisabled?: boolean;
	children?: Snippet;
}
</script>

<script lang="ts">
import { on } from 'svelte/events';
import {
	DOUBLE_FRAME_INNER_CLASS,
	DOUBLE_FRAME_OUTER_CLASS,
} from '#lib/components/ui/chip/chip-chrome.ts';
import Modal from '#lib/components/ui/modal/modal.svelte';
import ModalContent from '#lib/components/ui/modal/modal-content.svelte';
import { cn } from '#lib/utils/utils.ts';
import { ChipModalFocus, setChipModalFocus } from './chip-modal-focus.ts';

let {
	open = $bindable(false),
	onOpenChange,
	onsubmit,
	onOpenAutoFocus,
	srTitle = 'Dialog',
	size = 'md',
	class: className,
	dismissDisabled = false,
	children,
	'aria-describedby': ariaDescribedBy,
}: ChipModalProps = $props();

const focus = setChipModalFocus(new ChipModalFocus());

const frameClass = $derived(
	cn(
		'flex min-h-0 w-full flex-col text-small',
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
	<div class={cn('flex min-h-0 flex-col', DOUBLE_FRAME_INNER_CLASS)}>
		{@render children?.()}
	</div>
{/snippet}

<Modal bind:open {onOpenChange}>
	<ModalContent
		bare
		{srTitle}
		{size}
		{dismissDisabled}
		onOpenAutoFocus={onOpenAutoFocus ?? focus.focusOnOpen}
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
