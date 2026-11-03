<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const HOURS_PER_HALF_DAY = 12;
const LAST_HOUR_OF_DAY = 23;

function formatTimeLabel(value?: string): string {
	if (!value) return '';
	const [rawHour, rawMinute] = value.split(':');
	const hour = Number.parseInt(rawHour ?? '', 10);
	const minute = Number.parseInt(rawMinute ?? '', 10);
	if (Number.isNaN(hour) || Number.isNaN(minute)) return '';
	const period = hour >= HOURS_PER_HALF_DAY ? 'PM' : 'AM';
	const displayHour = hour % HOURS_PER_HALF_DAY || HOURS_PER_HALF_DAY;
	return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
}
function parseTimeInput(raw: string): string | null {
	const text = raw
		.trim()
		.toLowerCase()
		.replace(/\./g, ':')
		.replace(/\s+/g, ' ');
	const match = /^(\d{1,2}):?([0-5]\d)? ?(am?|pm?)?$/.exec(text);
	if (!match) return null;
	let hour = Number.parseInt(match[1] ?? '', 10);
	const minute = match[2] ? Number.parseInt(match[2], 10) : 0;
	const period = match[3];
	if (period) {
		if (hour < 1 || hour > HOURS_PER_HALF_DAY) return null;
		if (period.startsWith('p'))
			hour = hour === HOURS_PER_HALF_DAY ? hour : hour + HOURS_PER_HALF_DAY;
		else if (hour === HOURS_PER_HALF_DAY) hour = 0;
	} else if (hour > LAST_HOUR_OF_DAY) {
		return null;
	}
	return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}
</script>

<script lang="ts">
import type { ClassValue } from 'svelte/elements';
import ChipInput from './chip-input.svelte';

interface ChipTimePickerProps {
	value?: string;
	onChange?: (value: string) => void;
	placeholder?: string;
	disabled?: boolean;
	fullWidth?: boolean;
	class?: ClassValue;
	ref?: HTMLInputElement | null;
}

let {
	value = $bindable(),
	onChange,
	placeholder = '10:00 AM',
	disabled,
	fullWidth,
	class: className,
	ref = $bindable(null),
}: ChipTimePickerProps = $props();

let text = $derived(formatTimeLabel(value));

function commit() {
	const parsed = parseTimeInput(text);
	if (parsed) {
		text = formatTimeLabel(parsed);
		if (parsed !== value) {
			value = parsed;
			onChange?.(parsed);
		}
		return;
	}
	text = formatTimeLabel(value);
}

function handleKeyDown(
	event: KeyboardEvent & { currentTarget: HTMLInputElement }
) {
	if (event.key === 'Enter') {
		event.preventDefault();
		event.currentTarget.blur();
		return;
	}
	if (event.key === 'Escape') {
		text = formatTimeLabel(value);
		event.currentTarget.blur();
	}
}
</script>

<ChipInput
	bind:ref
	bind:value={text}
	onfocus={(event) => event.currentTarget.select()}
	onblur={commit}
	onkeydown={handleKeyDown}
	{placeholder}
	{disabled}
	aria-label="Time"
	autocomplete="off"
	spellcheck={false}
	class={[fullWidth ? 'w-full' : 'w-22', className]}
/>
