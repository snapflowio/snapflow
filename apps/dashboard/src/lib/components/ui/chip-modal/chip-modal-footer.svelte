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

interface ChipModalFooterCommonProps {
	onCancel?: () => void;
	cancelLabel?: string;
	hideCancel?: boolean;
	cancelDisabled?: boolean;
	defaultAction?: ChipModalFooterDefaultAction;
	primaryAdjacentAction?: Snippet;
	leadingContent?: Snippet;
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
import ChipModalSeparator from './chip-modal-separator.svelte';

let {
	onCancel,
	cancelLabel = 'Cancel',
	cancelDisabled,
	hideCancel = false,
	defaultAction = 'primary',
	primaryAction,
	primaryAdjacentAction,
	leadingContent,
}: ChipModalFooterProps = $props();

const modalContent = findModalContent();
const focus = getChipModalFocus();
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

{#snippet cancelChip(
	props: Record<string, unknown>
)}
	<Chip
		{...props}
		disabled={cancelBlocked}
		{@attach cancelFocusByDefault[defaultAction]}
	>
		{cancelLabel}
	</Chip>
{/snippet}

<div class="flex flex-col">
	<ChipModalSeparator />
	<div
		class={cn(
			'flex items-center gap-x-2 gap-y-1.5 bg-surface-3 px-4 pt-2 pb-2',
			leadingContent ? 'justify-between' : 'justify-end'
		)}
	>
		{#if leadingContent}
			<div class="flex min-w-0 flex-wrap items-center gap-2">
				{@render leadingContent()}
			</div>
		{/if}
		<div class="flex shrink-0 gap-2">
			{#if !hideCancel && onCancel}
				{@render cancelChip({ onclick: onCancel })}
			{:else if !hideCancel}
				<DialogPrimitive.Close disabled={cancelBlocked}>
					{#snippet child({
						props,
					})}
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
