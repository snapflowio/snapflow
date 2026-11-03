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
	HOST_LISTING_STATE_OPTIONS,
	HOST_LISTING_TIER_OPTIONS,
	HOST_LISTING_VISIBILITY_OPTIONS,
	type HostListingFilterPatch,
	type HostListingParams,
	isListingState,
	isListingVisibility,
	isMachineTier,
} from '#lib/features/listings/lib/host-listing-params.ts';

interface HostListingFiltersProps {
	params: HostListingParams;
	onChange: (patch: HostListingFilterPatch) => void;
	onClear: () => void;
}

let { params, onChange, onClear }: HostListingFiltersProps = $props();

const active = $derived(
	params.state.length + params.visibility.length + params.tier.length > 0
);
</script>

<ResourceFilterPanel>
	<ResourceFilterField label="State">
		<ChipCombobox
			multiple
			fullWidth
			aria-label="Filter by state"
			placeholder="All states"
			options={HOST_LISTING_STATE_OPTIONS}
			value={params.state}
			onChange={(values) => onChange({ state: values.filter(isListingState) })}
		/>
	</ResourceFilterField>
	<ResourceFilterField label="Visibility">
		<ChipCombobox
			multiple
			fullWidth
			aria-label="Filter by visibility"
			placeholder="All"
			options={HOST_LISTING_VISIBILITY_OPTIONS}
			value={params.visibility}
			onChange={(values) =>
				onChange({ visibility: values.filter(isListingVisibility) })}
		/>
	</ResourceFilterField>
	<ResourceFilterField label="Tier">
		<ChipCombobox
			multiple
			fullWidth
			aria-label="Filter by tier"
			placeholder="All tiers"
			options={HOST_LISTING_TIER_OPTIONS}
			value={params.tier}
			onChange={(values) => onChange({ tier: values.filter(isMachineTier) })}
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
