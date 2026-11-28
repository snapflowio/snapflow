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
import type { ChipInputProps } from './chip-input.svelte';

export interface ChipMoneyInputProps
	extends Omit<
		ChipInputProps,
		'value' | 'type' | 'inputmode' | 'startAdornment' | 'oninput'
	> {
	value?: bigint | null;
	decimals?: number;
	unit?: string;
	onValueChange?: (value: bigint | null) => void;
	trailing?: Snippet;
}

const DEFAULT_DECIMALS = 6;
const DISPLAY_DECIMALS = 2;
const DEFAULT_UNIT = 'USDC';
const DECIMAL_BASE = 10n;

function inputPattern(decimals: number): RegExp {
	return new RegExp(String.raw`^(\d*)(?:\.(\d{0,${decimals}}))?$`);
}

export function parseMoneyInput(text: string, decimals: number): bigint | null {
	const match = inputPattern(decimals).exec(text.trim().replaceAll(',', ''));
	if (!match) return null;
	const whole = match[1] ?? '';
	const fraction = match[2] ?? '';
	if (whole === '' && fraction === '') return null;
	const scale = DECIMAL_BASE ** BigInt(decimals);
	return (
		BigInt(whole || '0') * scale + BigInt(fraction.padEnd(decimals, '0') || '0')
	);
}

export function formatMoneyInput(value: bigint, decimals: number): string {
	const scale = DECIMAL_BASE ** BigInt(decimals);
	const whole = value / scale;
	const fraction = (value % scale).toString().padStart(decimals, '0');
	const trimmed = fraction.replace(/0+$/, '');
	const shown =
		trimmed.length > DISPLAY_DECIMALS
			? trimmed
			: fraction.slice(0, Math.min(DISPLAY_DECIMALS, decimals));
	return shown.length > 0 ? `${whole}.${shown}` : whole.toString();
}
</script>

<script lang="ts">
import ChipInput from './chip-input.svelte';
import ChipInputPrefix from './chip-input-prefix.svelte';
import ChipInputSuffix from './chip-input-suffix.svelte';

let {
	value = $bindable(null),
	decimals = DEFAULT_DECIMALS,
	unit = DEFAULT_UNIT,
	onValueChange,
	trailing,
	onblur,
	ref = $bindable(null),
	...rest
}: ChipMoneyInputProps = $props();

let text = $state('');
let lastValue: bigint | null | undefined;

$effect.pre(() => {
	if (value === lastValue) return;
	lastValue = value;
	if (parseMoneyInput(text, decimals) === value) return;
	text = value === null ? '' : formatMoneyInput(value, decimals);
});

function handleInput(next: string): void {
	text = next;
	const parsed = parseMoneyInput(next, decimals);
	lastValue = parsed;
	value = parsed;
	onValueChange?.(parsed);
}
</script>

{#snippet prefix()}
	<ChipInputPrefix>$</ChipInputPrefix>
{/snippet}

{#snippet suffix()}
	<ChipInputSuffix>{unit}</ChipInputSuffix>
	{@render trailing?.()}
{/snippet}

<ChipInput
	bind:ref
	type="text"
	inputmode="decimal"
	autocomplete="off"
	value={text}
	startAdornment={prefix}
	endAdornment={suffix}
	oninput={(event) => handleInput(event.currentTarget.value)}
	onblur={(event) => {
		if (value !== null) text = formatMoneyInput(value, decimals);
		onblur?.(event);
	}}
	{...rest}
/>
