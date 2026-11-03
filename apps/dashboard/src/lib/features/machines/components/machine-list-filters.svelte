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
import type { ChipOption } from '#lib/components/ui/chip/chip-selection.ts';
import {
	isMachineScheduling,
	isMachineState,
	MACHINE_SCHEDULING_OPTIONS,
	MACHINE_STATE_OPTIONS,
	type MachineListParams,
} from '#lib/features/machines/lib/machine-list-params.ts';

interface MachineListFiltersProps {
	params: MachineListParams;
	locationOptions: readonly ChipOption[];
	onChange: (
		patch: Partial<Pick<MachineListParams, 'state' | 'location' | 'scheduling'>>
	) => void;
	onClear: () => void;
}

let { params, locationOptions, onChange, onClear }: MachineListFiltersProps =
	$props();

const active = $derived(
	params.state.length + params.location.length + params.scheduling.length > 0
);
</script>

<ResourceFilterPanel>
	<ResourceFilterField label="State">
		<ChipCombobox
			multiple
			fullWidth
			aria-label="Filter by state"
			placeholder="All states"
			options={MACHINE_STATE_OPTIONS}
			value={params.state}
			onChange={(values) => onChange({ state: values.filter(isMachineState) })}
		/>
	</ResourceFilterField>
	<ResourceFilterField label="Location">
		<ChipCombobox
			multiple
			fullWidth
			aria-label="Filter by location"
			placeholder="All locations"
			options={locationOptions}
			value={params.location}
			onChange={(location) => onChange({ location })}
		/>
	</ResourceFilterField>
	<ResourceFilterField label="Scheduling">
		<ChipCombobox
			multiple
			fullWidth
			aria-label="Filter by scheduling"
			placeholder="All"
			options={MACHINE_SCHEDULING_OPTIONS}
			value={params.scheduling}
			onChange={(values) =>
				onChange({ scheduling: values.filter(isMachineScheduling) })}
		/>
	</ResourceFilterField>
	{#if active}
		<button
			type="button"
			class="h-8 w-full cursor-pointer rounded-md text-(--text-secondary) text-caption outline-none transition-colors hover-hover:bg-surface-active focus-visible:bg-surface-active"
			onclick={onClear}
		>
			Clear all filters
		</button>
	{/if}
</ResourceFilterPanel>
