<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { ChipOption } from '#lib/components/ui/chip/chip-selection.ts';

interface ResourceListFilterProps {
	label: string;
	options: readonly ChipOption[];
	value: string[];
	onChange: (values: string[]) => void;
	placeholder: string;
}
</script>

<script lang="ts">
import ResourceFilterField from '#lib/components/resource/filter/resource-filter-field.svelte';
import ResourceFilterPanel from '#lib/components/resource/filter/resource-filter-panel.svelte';
import ChipCombobox from '#lib/components/ui/chip/chip-combobox.svelte';

let { label, options, value, onChange, placeholder }: ResourceListFilterProps =
	$props();
</script>

<ResourceFilterPanel>
	<ResourceFilterField {label}>
		<ChipCombobox
			multiple
			fullWidth
			{options}
			{value}
			{onChange}
			{placeholder}
			aria-label={`Filter by ${label.toLowerCase()}`}
		/>
	</ResourceFilterField>
	{#if value.length > 0}
		<button
			type="button"
			class="h-8 w-full cursor-pointer rounded-md text-(--text-secondary) text-caption transition-colors hover-hover:bg-surface-active"
			onclick={() => onChange([])}
		>
			Clear all filters
		</button>
	{/if}
</ResourceFilterPanel>
