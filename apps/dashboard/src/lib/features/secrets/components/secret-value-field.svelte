<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { HTMLTextareaAttributes } from 'svelte/elements';

interface SecretValueFieldProps
	extends Omit<HTMLTextareaAttributes, 'value' | 'class'> {
	value?: string;
	error?: boolean;
}

const VALUE_ROWS = 3;
</script>

<script lang="ts">
import ChipTextarea from '#lib/components/ui/chip/chip-textarea.svelte';

let {
	value = $bindable(''),
	error: invalid = false,
	onfocus,
	onblur,
	...rest
}: SecretValueFieldProps = $props();

let focused = $state(false);
</script>

<ChipTextarea
	{...rest}
	bind:value
	error={invalid}
	rows={VALUE_ROWS}
	autocomplete="off"
	autocapitalize="off"
	spellcheck="false"
	class={[
		'font-mono',
		!focused && value.length > 0 && '[-webkit-text-security:disc]',
	]}
	onfocus={(event) => {
		focused = true;
		onfocus?.(event);
	}}
	onblur={(event) => {
		focused = false;
		onblur?.(event);
	}}
/>
