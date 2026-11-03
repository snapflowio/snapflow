<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import {
	type DateValue,
	getLocalTimeZone,
	isSameDay,
	isSameMonth,
	startOfMonth,
	today as todayIn,
} from '@internationalized/date';
import type { DateRange } from 'bits-ui';
import { calendarDateOf, parseDateValue } from './calendar-date-utils.ts';

function dayCellState(
	date: DateValue,
	{ start, end }: DateRange
): { hasBand: boolean; isEnd: boolean; isStart: boolean } {
	const isStart = start ? isSameDay(date, start) : false;
	const isEnd = end ? isSameDay(date, end) : false;
	if (!(start && end)) return { hasBand: false, isEnd, isStart };
	const within = date.compare(start) > 0 && date.compare(end) < 0;
	return { hasBand: within || isStart || isEnd, isEnd, isStart };
}

function calendarDateFrom(value: string | Date | undefined) {
	const date = parseDateValue(value);
	return date ? calendarDateOf(date) : undefined;
}
</script>

<script lang="ts">
import { RangeCalendar } from 'bits-ui';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipTimePicker from '#lib/components/ui/chip/chip-time-picker.svelte';
import { cn } from '#lib/utils/utils.ts';
import {
	buildRangeBounds,
	DEFAULT_RANGE_END_TIME,
	DEFAULT_RANGE_START_TIME,
	extractTime,
} from './calendar-date-utils.ts';
import CalendarDayCell from './calendar-day-cell.svelte';
import CalendarHeader from './calendar-header.svelte';
import type { CalendarRangeProps } from './calendar-types.ts';
import WeekdayRow from './weekday-row.svelte';

let {
	startDate,
	endDate,
	showTime = false,
	onRangeChange,
	onCancel,
	onClear,
	class: className,
}: CalendarRangeProps = $props();

const today = todayIn(getLocalTimeZone());
let range = $derived<DateRange>({
	start: calendarDateFrom(startDate),
	end: calendarDateFrom(endDate),
});
let startTime = $derived(extractTime(startDate, DEFAULT_RANGE_START_TIME));
let endTime = $derived(extractTime(endDate, DEFAULT_RANGE_END_TIME));

function clear() {
	range = { start: undefined, end: undefined };
	onClear?.();
}

function apply() {
	if (!range.start) return;
	const bounds = buildRangeBounds(range.start, range.end ?? range.start, {
		showTime,
		startTime,
		endTime,
	});
	onRangeChange(bounds.start, bounds.end);
}
</script>

<RangeCalendar.Root bind:value={range} weekdayFormat="short" preventDeselect>
	{#snippet child({
		props,
		months,
		weekdays,
	})}
		<div {...props} class={cn('flex w-[256px] flex-col p-2', className)}>
			<CalendarHeader />
			<WeekdayRow {weekdays} />

			{#each months as month (month.value.toString())}
				{const monthStart = $derived(startOfMonth(month.value))}
				<RangeCalendar.Grid>
					{#snippet child({
						props: gridProps,
					})}
						<div {...gridProps} class="grid grid-cols-7">
							{#each month.dates as date (date.toString())}
								{#if isSameMonth(date, month.value)}
									{const state = $derived(dayCellState(date, range))}
									<RangeCalendar.Cell {date} month={month.value}>
										{#snippet child({
											props: cellProps,
										})}
											<div
												{...cellProps}
												class={cn(
													'relative flex h-8.5 items-center justify-center',
													state.hasBand &&
														'before:absolute before:inset-y-0.5 before:right-0 before:left-0 before:bg-surface-active',
													state.hasBand &&
														state.isStart &&
														'before:left-0.75 before:rounded-l-lg',
													state.hasBand &&
														state.isEnd &&
														'before:right-0.75 before:rounded-r-lg'
												)}
											>
												<RangeCalendar.Day>
													{#snippet child({
														props: dayProps,
													})}
														<CalendarDayCell
															{...dayProps}
															selected={state.isStart || state.isEnd}
															today={isSameDay(date, today)}
															class="relative z-1"
														>
															{date.day}
														</CalendarDayCell>
													{/snippet}
												</RangeCalendar.Day>
											</div>
										{/snippet}
									</RangeCalendar.Cell>
								{:else if date.compare(monthStart) < 0}
									<div class="h-8.5"></div>
								{/if}
							{/each}
						</div>
					{/snippet}
				</RangeCalendar.Grid>
			{/each}

			{#if showTime}
				<div class="mt-1 flex items-center gap-2">
					<ChipTimePicker bind:value={startTime} fullWidth />
					<span class="shrink-0 text-(--text-muted) text-caption">to</span>
					<ChipTimePicker bind:value={endTime} fullWidth />
				</div>
			{/if}

			<div class="mt-1 flex items-center justify-between gap-2">
				<Chip onclick={clear} disabled={!range.start && !range.end}>Clear</Chip>
				<div class="flex items-center gap-2">
					<Chip variant="border" onclick={() => onCancel?.()}>Cancel</Chip>
					<Chip variant="primary" onclick={apply} disabled={!range.start}>
						Apply
					</Chip>
				</div>
			</div>
		</div>
	{/snippet}
</RangeCalendar.Root>
