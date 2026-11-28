<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { PANEL_MOTION_CLASS, SHEET_MOTION_CLASS } from './modal-animation.ts';

const MODAL_SIZES = {
	sm: 'w-[90vw] max-w-110',
	md: 'w-[90vw] max-w-125',
	lg: 'w-[90vw] max-w-150',
	xl: 'w-[90vw] max-w-200',
	full: 'w-[95vw] max-w-300',
} as const;

export type ModalSize = keyof typeof MODAL_SIZES;
export type ModalPlacement = 'center' | 'sheet';

const PLACEMENT_CLASS: Record<
	ModalPlacement,
	{ layer: string; content: string; surface: string; motion: string }
> = {
	center: {
		layer: 'items-center justify-center',
		content: 'max-h-[84vh] max-md:max-h-[calc(100dvh-2rem)]',
		surface:
			'overflow-hidden rounded-3xl border border-(--border-subtle) bg-surface-1 shadow-(--shadow-raised)',
		motion: PANEL_MOTION_CLASS,
	},
	sheet: {
		layer: 'items-stretch justify-end',
		content: 'h-dvh w-full md:w-[540px]',
		surface: 'overflow-hidden bg-surface-1',
		motion: SHEET_MOTION_CLASS,
	},
};

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
	placement?: ModalPlacement;
	bare?: boolean;
	srTitle?: string;
	dismissDisabled?: boolean;
	onOpenAutoFocus?: (event: Event) => void;
}

let {
	class: className,
	children,
	size = 'md',
	placement = 'center',
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
			'pointer-events-auto flex flex-col text-sm',
			PLACEMENT_CLASS[placement].content,
			!bare && PLACEMENT_CLASS[placement].surface,
			ANIMATION_CLASSES,
			PLACEMENT_CLASS[placement].motion,
			MODAL_ANIMATION_DURATION_CLASS,
			'data-[state=closed]:pointer-events-none',
			!modal.nativeSurfaceReady && 'data-[state=open]:paused',
			placement === 'center' && MODAL_SIZES[size],
			className
		)}
		onEscapeKeydown={handleEscapeKeydown}
		onInteractOutside={handleInteractOutside}
		onOpenAutoFocus={handleOpenAutoFocus}
		{...rest}
	>
		{#snippet child({ props, open })}
			<div
				class={cn(
					'fixed inset-0 z-(--z-modal) flex',
					PLACEMENT_CLASS[placement].layer,
					modal.nativeSurfaceReady && open
						? 'pointer-events-none'
						: 'pointer-events-auto',
					!open && 'pointer-events-none'
				)}
				data-native-surface-modal-content-layer=""
				style:padding-left={size === 'full' || placement === 'sheet'
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
							{#snippet child({ props: titleProps })}
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
