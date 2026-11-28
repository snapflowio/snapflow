<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const POPOVER_SIDE_OFFSET = 4;
const POPOVER_COLLISION_PADDING = 8;

export interface UsagePeriodValue<TPeriod extends string> {
	period: TPeriod;
	from: string;
	to: string;
}
</script>

<script lang="ts" generics="TPeriod extends string">
import { Popover } from 'bits-ui';
import { formatDateRangeLabel } from '#lib/components/ui/calendar/calendar-date-utils.ts';
import CalendarRangeView from '#lib/components/ui/calendar/calendar-range-view.svelte';
import {
	POPOVER_ANIMATION_CLASS,
	POPOVER_SURFACE_CLASS,
} from '#lib/components/ui/chip/chip-chrome.ts';
import ChipDropdown from '#lib/components/ui/chip/chip-dropdown.svelte';
import type { ChipOption } from '#lib/components/ui/chip/chip-selection.ts';
import { USAGE_PERIOD } from '#lib/features/billing/lib/usage-period.ts';

interface UsagePeriodPickerProps {
	selection: UsagePeriodValue<TPeriod>;
	onChange: (selection: UsagePeriodValue<TPeriod>) => void;
	options: readonly ChipOption<TPeriod>[];
	disabled?: boolean;
}

let { selection, onChange, options, disabled }: UsagePeriodPickerProps =
	$props();

let anchor = $state<HTMLButtonElement | null>(null);
let rangeOpen = $state(false);
const customPeriod = $derived(
	options.find((option) => option.value === USAGE_PERIOD.CUSTOM)?.value
);
const rangeLabel = $derived(
	selection.period === customPeriod
		? formatDateRangeLabel(selection.from, selection.to)
		: ''
);
const shownOptions = $derived(
	options.map((option) =>
		option.value === customPeriod && rangeLabel
			? { ...option, label: rangeLabel }
			: option
	)
);

function selectPeriod(period: TPeriod): void {
	if (period === customPeriod) {
		rangeOpen = true;
		return;
	}
	onChange({ period, from: '', to: '' });
}

function applyRange(from: string, to: string): void {
	if (customPeriod === undefined) return;
	onChange({ period: customPeriod, from, to });
	rangeOpen = false;
}
</script>

<ChipDropdown
	bind:ref={anchor}
	options={shownOptions}
	value={rangeOpen && customPeriod !== undefined
		? customPeriod
		: selection.period}
	onChange={selectPeriod}
	align="end"
	size="compact"
	{disabled}
	aria-label="Period"
/>
<Popover.Root bind:open={rangeOpen}>
	<Popover.Portal>
		<Popover.Content
			customAnchor={anchor}
			align="end"
			sideOffset={POPOVER_SIDE_OFFSET}
			collisionPadding={POPOVER_COLLISION_PADDING}
			trapFocus={false}
			data-native-surface-overlay=""
			class={[
				POPOVER_ANIMATION_CLASS,
				POPOVER_SURFACE_CLASS,
				'z-(--z-popover) origin-[--bits-popover-content-transform-origin]',
			]}
		>
			<CalendarRangeView
				startDate={selection.from || undefined}
				endDate={selection.to || undefined}
				showTime
				onRangeChange={applyRange}
				onCancel={() => {
					rangeOpen = false;
				}}
			/>
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
