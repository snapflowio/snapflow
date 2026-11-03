<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { ChipInputProps } from '#lib/components/ui/chip/chip-input.svelte';

interface SecretInputProps
	extends Omit<ChipInputProps, 'type' | 'value' | 'oninput' | 'onchange'> {
	value?: string;
	onChange?: (next: string) => void;
}

const MASK_CHARACTER = '•';
</script>

<script lang="ts">
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';

let {
	value = $bindable(''),
	onChange,
	onfocus,
	onblur,
	ref = $bindable(null),
	...props
}: SecretInputProps = $props();

let isFocused = $state(false);
const displayValue = $derived(
	isFocused ? value : MASK_CHARACTER.repeat(value.length)
);
</script>

<ChipInput
	bind:ref
	type="text"
	value={displayValue}
	oninput={(event) => {
		if (!isFocused) return;
		value = event.currentTarget.value;
		onChange?.(value);
	}}
	onfocus={(event) => {
		isFocused = true;
		onfocus?.(event);
	}}
	onblur={(event) => {
		isFocused = false;
		onblur?.(event);
	}}
	autocomplete="off"
	{...props}
/>
