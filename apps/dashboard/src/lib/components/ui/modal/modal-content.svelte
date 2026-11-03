<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const MODAL_SIZES = {
	sm: 'w-[90vw] max-w-110',
	md: 'w-[90vw] max-w-125',
	lg: 'w-[90vw] max-w-150',
	xl: 'w-[90vw] max-w-200',
	full: 'w-[95vw] max-w-300',
} as const;

export type ModalSize = keyof typeof MODAL_SIZES;

const FIRST_CONTROL_SELECTOR =
	'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const OPEN_FLOATING_LAYER_SELECTOR =
	'[data-bits-floating-content-wrapper] [data-state="open"]';

function hasOpenFloatingLayer(): boolean {
	return document.querySelector(OPEN_FLOATING_LAYER_SELECTOR) !== null;
}

function focusModalContent(content: HTMLElement): void {
	if (focusFirstTextInputIn(content)) return;
	const firstControl = content.querySelector<HTMLElement>(
		FIRST_CONTROL_SELECTOR
	);
	(firstControl ?? content).focus();
}
</script>

<script lang="ts">
import { type DialogContentProps, Dialog as DialogPrimitive } from 'bits-ui';
import { tick } from 'svelte';
import { cn } from '#lib/utils/utils.ts';
import { focusFirstTextInput, focusFirstTextInputIn } from './auto-focus.ts';
import {
	ANIMATION_CLASSES,
	MODAL_ANIMATION_DURATION_CLASS,
} from './modal-animation.ts';
import { ModalContentState, setModalContent } from './modal-content.svelte.ts';
import ModalOverlay from './modal-overlay.svelte';

interface ModalContentProps
	extends Omit<DialogContentProps, 'child' | 'forceMount' | 'onOpenAutoFocus'> {
	size?: ModalSize;
	bare?: boolean;
	srTitle?: string;
	dismissDisabled?: boolean;
	onOpenAutoFocus?: (event: Event) => void;
}

let {
	class: className,
	children,
	size = 'md',
	bare = false,
	srTitle,
	dismissDisabled = false,
	ref = $bindable(null),
	onOpenAutoFocus,
	onEscapeKeydown,
	onInteractOutside,
	'aria-describedby': ariaDescribedBy,
	...rest
}: ModalContentProps = $props();

const modal = setModalContent(
	new ModalContentState({
		dismissDisabled: () => dismissDisabled,
		onNativeSurfaceReady: () => void tick().then(focusDeferredContent),
	})
);

function runOpenAutoFocus(content: HTMLElement): boolean {
	const event = new Event('openAutoFocus', { cancelable: true });
	Object.defineProperty(event, 'currentTarget', { value: content });
	(onOpenAutoFocus ?? focusFirstTextInput)(event);
	return event.defaultPrevented;
}

function focusDeferredContent(): void {
	if (ref && !runOpenAutoFocus(ref) && !ref.contains(document.activeElement)) {
		focusModalContent(ref);
	}
}

function handleOpenAutoFocus(event: Event): void {
	if (modal.awaitingNativeSurface) {
		event.preventDefault();
		return;
	}
	if (ref && runOpenAutoFocus(ref)) event.preventDefault();
}

function handleEscapeKeydown(event: KeyboardEvent): void {
	if (dismissDisabled) event.preventDefault();
	event.stopPropagation();
	onEscapeKeydown?.(event);
}

function handleInteractOutside(event: PointerEvent): void {
	if (dismissDisabled || hasOpenFloatingLayer()) event.preventDefault();
	onInteractOutside?.(event);
}
</script>

<DialogPrimitive.Portal>
	<ModalOverlay {modal} />
	<DialogPrimitive.Content
		bind:ref
		class={cn(
			'pointer-events-auto flex max-h-[84vh] flex-col text-small max-md:max-h-[calc(100dvh-2rem)]',
			!bare && 'overflow-hidden rounded-xl border border-border bg-bg',
			ANIMATION_CLASSES,
			'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
			MODAL_ANIMATION_DURATION_CLASS,
			'data-[state=closed]:pointer-events-none',
			!modal.nativeSurfaceReady && 'data-[state=open]:paused',
			MODAL_SIZES[size],
			className
		)}
		onEscapeKeydown={handleEscapeKeydown}
		onInteractOutside={handleInteractOutside}
		onOpenAutoFocus={handleOpenAutoFocus}
		{...rest}
	>
		{#snippet child({
			props,
			open,
		})}
			<div
				class={cn(
					'fixed inset-0 z-(--z-modal) flex items-center justify-center',
					modal.nativeSurfaceReady && open
						? 'pointer-events-none'
						: 'pointer-events-auto',
					!open && 'pointer-events-none'
				)}
				data-native-surface-modal-content-layer=""
				style:padding-left={size === 'full'
					? undefined
					: 'var(--content-offset)'}
			>
				<div
					{...props}
					aria-describedby={ariaDescribedBy}
					data-native-surface-occlusion="modal"
					style:visibility={modal.nativeSurfaceReady ? undefined : 'hidden'}
				>
					{#if srTitle}
						<DialogPrimitive.Title class="sr-only">
							{#snippet child({
								props: titleProps,
							})}
								<h2 {...titleProps}>{srTitle}</h2>
							{/snippet}
						</DialogPrimitive.Title>
					{/if}
					{@render children?.()}
				</div>
			</div>
		{/snippet}
	</DialogPrimitive.Content>
</DialogPrimitive.Portal>
