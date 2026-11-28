<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { ClassValue } from 'svelte/elements';
import ChipDropdown from '#lib/components/ui/chip/chip-dropdown.svelte';
import type { ChipSwitchOption } from '#lib/components/ui/chip/chip-switch.svelte';
import ChipSwitch from '#lib/components/ui/chip/chip-switch.svelte';
import { cn } from '#lib/utils/utils.ts';

interface ChipModalTabsProps {
	tabs: readonly ChipSwitchOption[];
	value?: string;
	onChange?: (value: string) => void;
	'aria-label'?: string;
	class?: ClassValue;
}

let {
	tabs,
	value = $bindable(''),
	onChange,
	'aria-label': ariaLabel,
	class: className,
}: ChipModalTabsProps = $props();

function select(next: string): void {
	value = next;
	onChange?.(next);
}
</script>

<ChipSwitch
	{value}
	onChange={select}
	aria-label={ariaLabel}
	options={tabs}
	class={cn('w-fit max-sm:hidden', className)}
/>
<div class={cn('sm:hidden', className)}>
	<ChipDropdown
		{value}
		onChange={select}
		aria-label={ariaLabel}
		options={tabs}
		fullWidth
		align="start"
	/>
</div>
