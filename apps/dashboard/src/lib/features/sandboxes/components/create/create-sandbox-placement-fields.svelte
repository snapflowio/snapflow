<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->
<script lang="ts" module>
import {
	MachineCategory,
	MachineTier,
	PlacementKind,
} from '@snapflow/api-client';
import {
	MACHINE_CATEGORY_LABELS,
	MACHINE_TIER_LABELS,
	MACHINE_TIER_ORDER,
} from '#lib/features/listings/lib/listing-format.ts';

const PLACEMENT_TABS = [
	{ label: 'Any matching machine', value: PlacementKind.Flexible },
	{ label: 'Specific machine', value: PlacementKind.Pinned },
];
const ANY = '';
const CATEGORY_OPTIONS = [
	{ label: 'Any category', value: ANY },
	...Object.values(MachineCategory).map((category) => ({
		label: MACHINE_CATEGORY_LABELS[category],
		value: category,
	})),
];
const TIER_OPTIONS = [
	{ label: 'Any tier', value: ANY },
	...MACHINE_TIER_ORDER.filter((tier) => tier !== MachineTier.Private).map(
		(tier) => ({ label: `${MACHINE_TIER_LABELS[tier]} or better`, value: tier })
	),
];
const PLACEMENT_KINDS = new Set<string>(Object.values(PlacementKind));

function isPlacementKind(value: string): value is PlacementKind {
	return PLACEMENT_KINDS.has(value);
}
</script>

<script lang="ts">
import type { Location } from '@snapflow/api-client';
import type { ChipOption } from '#lib/components/ui/chip/chip-selection.ts';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalTabs from '#lib/components/ui/chip-modal/chip-modal-tabs.svelte';
import GeolocationAttribution from '#lib/features/locations/components/geolocation-attribution.svelte';
import { formatLocation } from '#lib/features/locations/lib/location-format.ts';
import type { CreateSandboxForm } from '#lib/features/sandboxes/state/create-sandbox-wizard.svelte.ts';
import CreateSandboxPinnedMachineField from './create-sandbox-pinned-machine-field.svelte';

interface CreateSandboxPlacementFieldsProps {
	callerLocation: Location | null;
	form: CreateSandboxForm;
	locationOptions: readonly ChipOption[];
	open: boolean;
}

let {
	callerLocation,
	form,
	locationOptions,
	open,
}: CreateSandboxPlacementFieldsProps = $props();

const automaticLabel = $derived.by(() => {
	const caller = formatLocation(callerLocation);
	return caller ? `Nearest to you (${caller})` : 'Nearest available machine';
});
</script>

<form.Subscribe
	selector={(state) =>
		[state.values.placementKind, state.values.machineId] as const}
>
	{#snippet children([placementKind, machineId])}
		<form.AppField name="placementKind">
			{#snippet children(
				field
			)}
				<ChipModalField label="Placement">
					<ChipModalTabs
						aria-label="Placement"
						tabs={PLACEMENT_TABS}
						value={field.state.value}
						onChange={(value) => {
							if (isPlacementKind(value)) field.handleChange(value);
						}}
					/>
				</ChipModalField>
			{/snippet}
		</form.AppField>
		{#if placementKind === PlacementKind.Pinned}
			<CreateSandboxPinnedMachineField {form} {machineId} {open} />
		{:else}
			<form.AppField name="locations">
				{#snippet children(
					field
				)}
					<field.MultiSelectField
						label="Location"
						options={locationOptions}
						emptyLabel={automaticLabel}
						disabled={locationOptions.length === 0}
						searchable
					/>
				{/snippet}
			</form.AppField>
			<p
				class="-mt-1.75 flex flex-wrap items-center justify-between gap-x-3 px-2 text-(--text-muted) text-caption"
			>
				<span
					>Restrict to continents or countries, most preferred first. Leave
					empty to use the nearest machine.</span
				>
				<GeolocationAttribution />
			</p>
			<form.AppField name="ownMachinesOnly">
				{#snippet children(
					field
				)}
					<field.SwitchField
						label="Only my machines"
						description="Machine time on your own machines is free and does not count against quotas. Network traffic is still billed."
					/>
				{/snippet}
			</form.AppField>
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
				<form.AppField name="placementCategory">
					{#snippet children(
						field
					)}
						<field.SelectField label="Category" options={CATEGORY_OPTIONS} />
					{/snippet}
				</form.AppField>
				<form.AppField name="minimumTier">
					{#snippet children(
						field
					)}
						<field.SelectField label="Minimum tier" options={TIER_OPTIONS} />
					{/snippet}
				</form.AppField>
				<form.AppField name="maxHourlyPriceUsd">
					{#snippet children(
						field
					)}
						<field.TextField
							label="Max $/h"
							inputmode="decimal"
							placeholder="No limit"
						/>
					{/snippet}
				</form.AppField>
			</div>
		{/if}
	{/snippet}
</form.Subscribe>
