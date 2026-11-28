<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ChipInput, {
	type ChipInputProps,
} from '#lib/components/ui/chip/chip-input.svelte';
import ChipInputPrefix from '#lib/components/ui/chip/chip-input-prefix.svelte';
import ChipInputSuffix from '#lib/components/ui/chip/chip-input-suffix.svelte';

interface RateInputProps extends ChipInputProps {
	prefix?: string;
	suffix: string;
}

let {
	prefix = '$',
	suffix,
	value = $bindable(),
	...rest
}: RateInputProps = $props();
</script>

{#snippet startAdornment()}
	<ChipInputPrefix>{prefix}</ChipInputPrefix>
{/snippet}

{#snippet endAdornment()}
	<ChipInputSuffix>{suffix}</ChipInputSuffix>
{/snippet}

<ChipInput
	bind:value
	inputmode="decimal"
	startAdornment={prefix ? startAdornment : undefined}
	{endAdornment}
	{...rest}
/>
