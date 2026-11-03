<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { MachineCategory, MachineTier } from '@snapflow/api-client';
import {
	MACHINE_CATEGORY_LABELS,
	MACHINE_CATEGORY_ORDER,
	MACHINE_TIER_LABELS,
	MACHINE_TIER_ORDER,
} from '#lib/features/listings/lib/listing-format.ts';
import {
	getGpuOptions,
	isGpuType,
} from '#lib/features/machines/lib/gpu-options.ts';

const ANY = 'any';
const FREE_EGRESS = '0';
const FIRST_GPU = '1';
const CATEGORY_OPTIONS = [
	{ value: ANY, label: 'All' },
	...MACHINE_CATEGORY_ORDER.map((category) => ({
		value: category,
		label: MACHINE_CATEGORY_LABELS[category],
	})),
];
const TIER_OPTIONS = [
	{ value: ANY, label: 'Any tier' },
	...MACHINE_TIER_ORDER.filter((tier) => tier !== MachineTier.Private).map(
		(tier) => ({ value: tier, label: `${MACHINE_TIER_LABELS[tier]} or better` })
	),
];
const GPU_MODEL_OPTIONS = getGpuOptions(undefined);
const VCPU_PRESETS = ['1', '2', '4', '8', '16', '32', '64'];
const MEMORY_PRESETS = ['1', '2', '4', '8', '16', '32', '64', '128', '256'];
const DISK_PRESETS = ['10', '20', '50', '100', '250', '500', '1000'];
const NO_GPU = '0';
const GPU_PRESETS = [NO_GPU, '1', '2', '4', '8'];
const RELIABILITY_PRESETS = ['90', '95', '99', '99.9'];
const CATEGORY_VALUES = new Set<string>(Object.values(MachineCategory));
const TIER_VALUES = new Set<string>(Object.values(MachineTier));

function isMachineCategory(value: string): value is MachineCategory {
	return CATEGORY_VALUES.has(value);
}

function isMachineTier(value: string): value is MachineTier {
	return TIER_VALUES.has(value);
}

function presetOptions(
	presets: readonly string[],
	current: string,
	format: (value: string) => string
) {
	const values =
		current && !presets.includes(current) && Number.isFinite(Number(current))
			? [...presets, current].sort((a, b) => Number(a) - Number(b))
			: presets;
	return values.map((value) => ({ value, label: format(value) }));
}
</script>

<script lang="ts">
import ResourceFilterField from '#lib/components/resource/filter/resource-filter-field.svelte';
import ResourceFilterToggle from '#lib/components/resource/filter/resource-filter-toggle.svelte';
import ChipCombobox from '#lib/components/ui/chip/chip-combobox.svelte';
import ChipDropdown from '#lib/components/ui/chip/chip-dropdown.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipInputPrefix from '#lib/components/ui/chip/chip-input-prefix.svelte';
import ChipInputSuffix from '#lib/components/ui/chip/chip-input-suffix.svelte';
import { BINARY_UNITS_NOTE } from '#lib/features/billing/lib/transfer.ts';
import type { MachineBrowser } from '#lib/features/listings/state/machine-browser.svelte.ts';
import GeolocationAttribution from '#lib/features/locations/components/geolocation-attribution.svelte';
import ListingFilterSection from './listing-filter-section.svelte';

interface MachineListFiltersProps {
	browser: MachineBrowser;
}

let { browser }: MachineListFiltersProps = $props();

const params = $derived(browser.params);
const vcpuOptions = $derived(
	presetOptions(VCPU_PRESETS, params.cpu, (value) => `${value} vCPU`)
);
const memoryOptions = $derived(
	presetOptions(MEMORY_PRESETS, params.memoryGiB, (value) => `${value} GiB`)
);
const diskOptions = $derived(
	presetOptions(DISK_PRESETS, params.diskGiB, (value) => `${value} GiB`)
);
const gpuOptions = $derived(
	presetOptions(GPU_PRESETS, params.gpu, (value) =>
		value === NO_GPU ? 'None' : `${value} GPU`
	)
);
const reliabilityOptions = $derived([
	{ value: ANY, label: 'Any' },
	...presetOptions(
		RELIABILITY_PRESETS,
		params.minimumReliabilityPercent,
		(value) => `${value}% or more`
	),
]);
</script>

{#snippet dollarPrefix()}
	<ChipInputPrefix>$</ChipInputPrefix>
{/snippet}

{#snippet hourSuffix()}
	<ChipInputSuffix>/h</ChipInputSuffix>
{/snippet}

{#snippet gigabyteSuffix()}
	<ChipInputSuffix>/GB</ChipInputSuffix>
{/snippet}

<ListingFilterSection title="Category">
	<ChipDropdown
		fullWidth
		align="start"
		aria-label="Category"
		options={CATEGORY_OPTIONS}
		value={params.category ?? ANY}
		onChange={(value: string) =>
			browser.update({ category: isMachineCategory(value) ? value : null })}
	/>
</ListingFilterSection>

<ListingFilterSection title="Resources">
	<div class="grid grid-cols-2 gap-3">
		<ResourceFilterField label="Min vCPU">
			<ChipDropdown
				fullWidth
				align="start"
				aria-label="Minimum vCPU"
				options={vcpuOptions}
				value={params.cpu}
				onChange={(cpu: string) => browser.update({ cpu })}
			/>
		</ResourceFilterField>
		<ResourceFilterField label="Min memory">
			<ChipDropdown
				fullWidth
				align="start"
				aria-label="Minimum memory"
				options={memoryOptions}
				value={params.memoryGiB}
				onChange={(memoryGiB: string) => browser.update({ memoryGiB })}
			/>
		</ResourceFilterField>
		<ResourceFilterField label="Min disk">
			<ChipDropdown
				fullWidth
				align="start"
				aria-label="Minimum disk"
				options={diskOptions}
				value={params.diskGiB}
				onChange={(diskGiB: string) => browser.update({ diskGiB })}
			/>
		</ResourceFilterField>
		<ResourceFilterField label="Min GPUs">
			<ChipDropdown
				fullWidth
				align="start"
				aria-label="Minimum GPUs"
				options={gpuOptions}
				value={params.gpu}
				onChange={(gpu: string) =>
					browser.update(gpu === NO_GPU ? { gpu, gpuType: [] } : { gpu })}
			/>
		</ResourceFilterField>
	</div>
</ListingFilterSection>

<ListingFilterSection title="GPU model">
	<ChipCombobox
		multiple
		fullWidth
		aria-label="Filter by GPU model"
		placeholder="Any GPU model"
		options={GPU_MODEL_OPTIONS}
		value={params.gpuType}
		onChange={(values) => {
			const gpuType = values.filter(isGpuType);
			browser.update(
				gpuType.length > 0 && params.gpu === NO_GPU
					? { gpuType, gpu: FIRST_GPU }
					: { gpuType }
			);
		}}
	/>
</ListingFilterSection>

<ListingFilterSection title="Location">
	<ChipCombobox
		multiple
		fullWidth
		aria-label="Filter by location"
		placeholder="All locations"
		options={browser.locationOptions}
		value={params.locations}
		onChange={(locations) => browser.update({ locations })}
	/>
	<GeolocationAttribution class="px-2" />
</ListingFilterSection>

<ListingFilterSection title="Tier">
	<ChipDropdown
		fullWidth
		align="start"
		aria-label="Minimum tier"
		options={TIER_OPTIONS}
		value={params.minimumTier ?? ANY}
		onChange={(value: string) =>
			browser.update({ minimumTier: isMachineTier(value) ? value : null })}
	/>
</ListingFilterSection>

<ListingFilterSection title="Price">
	<ResourceFilterField label="Max price">
		<ChipInput
			aria-label="Maximum hourly price in USD"
			inputmode="decimal"
			placeholder="Any"
			bind:value={browser.maxHourlyPrice.value}
			startAdornment={dollarPrefix}
			endAdornment={hourSuffix}
		/>
	</ResourceFilterField>
</ListingFilterSection>

<ListingFilterSection title="Reliability">
	<ChipDropdown
		fullWidth
		align="start"
		aria-label="Minimum reliability"
		options={reliabilityOptions}
		value={params.minimumReliabilityPercent || ANY}
		onChange={(value: string) =>
			browser.update({
				minimumReliabilityPercent: value === ANY ? '' : value,
			})}
	/>
</ListingFilterSection>

<ListingFilterSection title="Network">
	<ResourceFilterField label="Max egress">
		<ChipInput
			aria-label="Maximum egress price in USD per GB"
			title={BINARY_UNITS_NOTE}
			inputmode="decimal"
			placeholder="Any"
			bind:value={browser.maxEgressPrice.value}
			startAdornment={dollarPrefix}
			endAdornment={gigabyteSuffix}
		/>
	</ResourceFilterField>
	<ResourceFilterToggle
		label="Free egress only"
		checked={params.maxEgressPriceUsd === FREE_EGRESS}
		onCheckedChange={(free) =>
			browser.update({ maxEgressPriceUsd: free ? FREE_EGRESS : '' })}
	/>
</ListingFilterSection>

<ListingFilterSection title="Availability">
	<ResourceFilterToggle
		label="Show unavailable machines"
		checked={params.includeUnavailable}
		onCheckedChange={(includeUnavailable) =>
			browser.update({ includeUnavailable })}
	/>
	<ResourceFilterToggle
		label="Supports volumes"
		checked={params.persistentVolumes}
		onCheckedChange={(persistentVolumes) =>
			browser.update({ persistentVolumes })}
	/>
</ListingFilterSection>
