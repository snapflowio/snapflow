<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { ChipSwitchOption } from '#lib/components/ui/chip/chip-switch.svelte';

interface ResourceViewSwitchProps<T extends string> {
	options: readonly ChipSwitchOption<T>[];
	value: T;
	onChange: (value: T) => void;
	'aria-label'?: string;
}
</script>

<script lang="ts" generics="T extends string">
import ChipDropdown from '#lib/components/ui/chip/chip-dropdown.svelte';
import ChipSwitch from '#lib/components/ui/chip/chip-switch.svelte';

let {
	options,
	value,
	onChange,
	'aria-label': ariaLabel = 'View',
}: ResourceViewSwitchProps<T> = $props();
</script>

<div class="hidden shrink-0 @5xl/toolbar:flex">
	<ChipSwitch
		{options}
		{value}
		{onChange}
		aria-label={ariaLabel}
		size="compact"
	/>
</div>
<div class="flex shrink-0 @5xl/toolbar:hidden">
	<ChipDropdown
		{options}
		{value}
		{onChange}
		aria-label={ariaLabel}
		size="compact"
		align="start"
		matchTriggerWidth={false}
	/>
</div>
