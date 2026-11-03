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

const POPOVER_SIDE_OFFSET = 6;
const POPOVER_COLLISION_PADDING = 8;

interface ChipDateRangePickerProps {
	variant?: 'filled' | 'ghost';
	label?: string;
	placeholder?: string;
	align?: 'start' | 'center' | 'end';
	disabled?: boolean;
	fullWidth?: boolean;
	class?: ClassValue;
	ref?: HTMLButtonElement | null;
	startDate?: string;
	endDate?: string;
	showTime?: boolean;
	onRangeChange?: (start: string, end: string) => void;
}
</script>

<script lang="ts">
import { Popover } from 'bits-ui';
import { formatDateRangeLabel } from '#lib/components/ui/calendar/calendar-date-utils.ts';
import CalendarRangeView from '#lib/components/ui/calendar/calendar-range-view.svelte';
import { POPOVER_ANIMATION_CLASS } from '#lib/components/ui/chip/chip-chrome.ts';
import ChipTrigger from './chip-trigger.svelte';

let {
	ref = $bindable(null),
	startDate = $bindable(),
	endDate = $bindable(),
	...props
}: ChipDateRangePickerProps = $props();

let open = $state(false);
const placeholder = $derived(props.placeholder ?? 'Select date range');
const triggerText = $derived(
	props.label ?? formatDateRangeLabel(startDate, endDate)
);

function changeRange(start: string, end: string): void {
	startDate = start;
	endDate = end;
	props.onRangeChange?.(start, end);
	open = false;
}
</script>

<Popover.Root bind:open>
	<Popover.Trigger disabled={props.disabled}>
		{#snippet child({
			props: triggerProps,
		})}
			<ChipTrigger
				bind:ref
				{...triggerProps}
				variant={props.variant}
				label={triggerText || placeholder}
				muted={!triggerText}
				disabled={props.disabled}
				fullWidth={props.fullWidth}
				class={props.class}
			/>
		{/snippet}
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content
			align={props.align ?? 'start'}
			sideOffset={POPOVER_SIDE_OFFSET}
			collisionPadding={POPOVER_COLLISION_PADDING}
			trapFocus={false}
			data-native-surface-overlay=""
			class={[
				POPOVER_ANIMATION_CLASS,
				'z-(--z-popover) origin-[--bits-popover-content-transform-origin] rounded-xl border border-border bg-bg shadow-sm',
			]}
		>
			<CalendarRangeView
				{startDate}
				{endDate}
				showTime={props.showTime}
				onRangeChange={changeRange}
				onCancel={() => {
					open = false;
				}}
			/>
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
