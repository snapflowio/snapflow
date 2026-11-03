<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ResourceFilterField from '#lib/components/resource/filter/resource-filter-field.svelte';
import ResourceFilterPanel from '#lib/components/resource/filter/resource-filter-panel.svelte';
import ChipCombobox from '#lib/components/ui/chip/chip-combobox.svelte';
import {
	type AdminFilterField,
	hasAdminFilters,
} from '#lib/features/admin/lib/admin-filters.ts';

interface AdminFilterPanelProps {
	fields: readonly AdminFilterField[];
	onClear: () => void;
}

let { fields, onClear }: AdminFilterPanelProps = $props();
</script>

<ResourceFilterPanel>
	{#each fields as field (field.id)}
		<ResourceFilterField label={field.label}>
			<ChipCombobox
				multiple
				fullWidth
				aria-label={field.label}
				placeholder={`All ${field.label.toLowerCase()}`}
				options={field.options}
				value={[...field.values]}
				onChange={(values) => field.onChange(values)}
			/>
		</ResourceFilterField>
	{/each}
	{#if hasAdminFilters(fields)}
		<button
			type="button"
			class="h-8 w-full cursor-pointer rounded-md text-(--text-secondary) text-caption outline-none transition-colors hover-hover:bg-surface-active focus-visible:bg-surface-active"
			onclick={onClear}
		>
			Clear all filters
		</button>
	{/if}
</ResourceFilterPanel>
