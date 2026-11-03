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
</script>

<script lang="ts">
import { Popover } from 'bits-ui';
import { formatDateRangeLabel } from '#lib/components/ui/calendar/calendar-date-utils.ts';
import CalendarRangeView from '#lib/components/ui/calendar/calendar-range-view.svelte';
import { POPOVER_ANIMATION_CLASS } from '#lib/components/ui/chip/chip-chrome.ts';
import ChipDropdown from '#lib/components/ui/chip/chip-dropdown.svelte';
import {
	USAGE_PERIOD,
	USAGE_PERIOD_OPTIONS,
	type UsagePeriod,
	type UsagePeriodSelection,
} from '#lib/features/billing/lib/usage-period.ts';

interface UsagePeriodPickerProps {
	selection: UsagePeriodSelection;
	onChange: (selection: UsagePeriodSelection) => void;
	disabled?: boolean;
}

let { selection, onChange, disabled }: UsagePeriodPickerProps = $props();

let anchor = $state<HTMLButtonElement | null>(null);
let rangeOpen = $state(false);
const rangeLabel = $derived(
	selection.period === USAGE_PERIOD.CUSTOM
		? formatDateRangeLabel(selection.from, selection.to)
		: ''
);
const options = $derived(
	USAGE_PERIOD_OPTIONS.map((option) =>
		option.value === USAGE_PERIOD.CUSTOM && rangeLabel
			? { ...option, label: rangeLabel }
			: option
	)
);

function selectPeriod(period: UsagePeriod): void {
	if (period === USAGE_PERIOD.CUSTOM) {
		rangeOpen = true;
		return;
	}
	onChange({ period, from: '', to: '' });
}

function applyRange(from: string, to: string): void {
	onChange({ period: USAGE_PERIOD.CUSTOM, from, to });
	rangeOpen = false;
}
</script>

<ChipDropdown
	bind:ref={anchor}
	{options}
	value={rangeOpen ? USAGE_PERIOD.CUSTOM : selection.period}
	onChange={selectPeriod}
	align="end"
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
				'z-(--z-popover) origin-[--bits-popover-content-transform-origin] rounded-xl border border-border bg-bg shadow-sm',
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
