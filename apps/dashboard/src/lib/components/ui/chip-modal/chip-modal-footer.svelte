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
import type { Attachment } from 'svelte/attachments';

type ChipModalFooterDefaultAction = 'primary' | 'dismiss' | 'none';
export type ChipModalFooterVariant = 'form' | 'confirm';
type ChipModalFooterLayout = ChipModalFooterVariant | 'sheet';

const FOOTER_PADDING_CLASS: Record<ChipModalFooterLayout, string> = {
	form: 'gap-2 px-6 pt-2 pb-6',
	confirm: 'gap-4 px-8 pt-2 pb-8',
	sheet: 'gap-4 bg-surface-1 px-8 py-6',
};
const FOOTER_ACTIONS_GAP_CLASS: Record<ChipModalFooterVariant, string> = {
	form: 'gap-2',
	confirm: 'gap-4',
};

interface ChipModalFooterCommonProps {
	onCancel?: () => void;
	cancelLabel?: string;
	hideCancel?: boolean;
	cancelDisabled?: boolean;
	defaultAction?: ChipModalFooterDefaultAction;
	primaryAdjacentAction?: Snippet;
	leadingContent?: Snippet;
	variant?: ChipModalFooterVariant;
}
type ChipModalFooterProps = ChipModalFooterCommonProps &
	(
		| {
				primaryAction: Snippet<[initialFocus: Attachment<HTMLElement>]>;
		  }
		| {
				primaryAction?: undefined;
				defaultAction: Exclude<ChipModalFooterDefaultAction, 'primary'>;
		  }
	);
</script>

<script lang="ts">
import { Dialog as DialogPrimitive } from 'bits-ui';
import Chip from '#lib/components/ui/chip/chip.svelte';
import { findModalContent } from '#lib/components/ui/modal/modal-content.svelte.ts';
import { cn } from '#lib/utils/utils.ts';
import { getChipModalFocus } from './chip-modal-focus.ts';
import { findChipModalVariant } from './chip-modal-variant.ts';

let {
	onCancel,
	cancelLabel = 'Cancel',
	cancelDisabled,
	hideCancel = false,
	defaultAction = 'primary',
	primaryAction,
	primaryAdjacentAction,
	leadingContent,
	variant = 'form',
}: ChipModalFooterProps = $props();

const modalContent = findModalContent();
const focus = getChipModalFocus();
const modalVariant = findChipModalVariant();
const paddingVariant = $derived<ChipModalFooterLayout>(
	modalVariant() === 'sheet' ? 'sheet' : variant
);
const cancelBlocked = $derived(
	cancelDisabled || modalContent?.dismissDisabled === true
);
const cancelFocusByDefault: Record<
	ChipModalFooterDefaultAction,
	Attachment<HTMLElement> | undefined
> = {
	primary: focus.fallback,
	dismiss: focus.initial,
	none: undefined,
};
</script>

{#snippet cancelChip(props: Record<string, unknown>)}
	<Chip
		{...props}
		disabled={cancelBlocked}
		{@attach cancelFocusByDefault[defaultAction]}
	>
		{cancelLabel}
	</Chip>
{/snippet}

<div
	class={cn(
		'flex shrink-0 flex-col',
		paddingVariant === 'sheet' &&
			'border-transparent border-t peer-data-[scroll-fade-bottom]/chip-modal-body:border-border'
	)}
>
	<div
		class={cn(
			'flex flex-wrap items-center gap-y-2 sm:flex-nowrap',
			FOOTER_PADDING_CLASS[paddingVariant],
			leadingContent ? 'justify-between' : 'justify-end'
		)}
	>
		{#if leadingContent}
			<div class="flex min-w-0 flex-wrap items-center gap-2">
				{@render leadingContent()}
			</div>
		{/if}
		<div class={cn('ml-auto flex shrink-0', FOOTER_ACTIONS_GAP_CLASS[variant])}>
			{#if !hideCancel && onCancel}
				{@render cancelChip({ onclick: onCancel })}
			{:else if !hideCancel}
				<DialogPrimitive.Close disabled={cancelBlocked}>
					{#snippet child({ props })}
						{@render cancelChip(props)}
					{/snippet}
				</DialogPrimitive.Close>
			{/if}
			{@render primaryAdjacentAction?.()}
			<div
				class="contents"
				data-chip-modal-primary={defaultAction === 'primary' ? '' : undefined}
			>
				{@render primaryAction?.(focus.initial)}
			</div>
		</div>
	</div>
</div>
