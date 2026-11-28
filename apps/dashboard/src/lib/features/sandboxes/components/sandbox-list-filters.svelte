<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { SandboxClass, SandboxState } from '@snapflow/api-client';
import {
	sandboxClassLabel,
	sandboxStateLabel,
} from '#lib/features/sandboxes/lib/sandbox-state.ts';

const FILTERABLE_STATES = Object.values(SandboxState).filter(
	(state) => state !== SandboxState.Destroyed
);
const FILTERABLE_CLASSES = Object.values(SandboxClass);
const STATE_OPTIONS = FILTERABLE_STATES.map((state) => ({
	value: state,
	label: sandboxStateLabel(state),
}));
const CLASS_OPTIONS = FILTERABLE_CLASSES.map((sandboxClass) => ({
	value: sandboxClass,
	label: sandboxClassLabel(sandboxClass),
}));
const STATE_VALUES = new Set<string>(FILTERABLE_STATES);
const CLASS_VALUES = new Set<string>(FILTERABLE_CLASSES);
const ANY_BOOLEAN = 'all';
const BOOLEAN_OPTIONS = [
	{ value: ANY_BOOLEAN, label: 'Any' },
	{ value: 'true', label: 'Yes' },
	{ value: 'false', label: 'No' },
];
const LABELS_PLACEHOLDER = 'environment=development\nteam=platform';
const MINIMUM_RESOURCE_FILTER = 1;

const RESOURCE_RANGE_FIELDS = [
	{ key: 'minCpu', label: 'Minimum vCPU', placeholder: 'Min vCPU' },
	{ key: 'maxCpu', label: 'Maximum vCPU', placeholder: 'Max vCPU' },
	{ key: 'minMemory', label: 'Minimum memory', placeholder: 'Min GiB' },
	{ key: 'maxMemory', label: 'Maximum memory', placeholder: 'Max GiB' },
	{ key: 'minDisk', label: 'Minimum disk', placeholder: 'Min disk' },
	{ key: 'maxDisk', label: 'Maximum disk', placeholder: 'Max disk' },
] as const;

type DateField =
	| 'createdAtAfter'
	| 'createdAtBefore'
	| 'lastEventAfter'
	| 'lastEventBefore';

function isSandboxState(value: string): value is SandboxState {
	return STATE_VALUES.has(value);
}

function isSandboxClass(value: string): value is SandboxClass {
	return CLASS_VALUES.has(value);
}

function booleanFilterValue(value: boolean | undefined): string {
	if (value === undefined) return ANY_BOOLEAN;
	return String(value);
}

function parseBooleanFilter(value: string): boolean | undefined {
	if (value === 'true') return true;
	if (value === 'false') return false;
	return undefined;
}
</script>

<script lang="ts">
import ChevronRight from '@lucide/svelte/icons/chevron-right';
import { createQuery } from '@tanstack/svelte-query';
import { machineLocationsQueryOptions } from '#lib/api/locations.ts';
import { allSnapshotsQueryOptions } from '#lib/api/snapshots.ts';
import ResourceFilterField from '#lib/components/resource/filter/resource-filter-field.svelte';
import ResourceFilterPanel, {
	type ResourceQuickFilterField,
} from '#lib/components/resource/filter/resource-filter-panel.svelte';
import ResourceFilterToggle from '#lib/components/resource/filter/resource-filter-toggle.svelte';
import ChipDropdown from '#lib/components/ui/chip/chip-dropdown.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipTextarea from '#lib/components/ui/chip/chip-textarea.svelte';
import {
	MENU_ROW_BASE_CLASS,
	MENU_ROW_SIZES,
} from '#lib/components/ui/dropdown-menu/dropdown-menu-styles.ts';
import { locationOptions } from '#lib/features/locations/lib/location-format.ts';
import {
	clearedSandboxParams,
	hasActiveMoreFilters,
	hasActiveSandboxFilters,
	SANDBOX_FILTER_KEYS,
	type SandboxListValues,
	type SandboxTextFilterKey,
	SandboxView,
	sandboxListSchema,
} from '#lib/features/sandboxes/lib/sandbox-list-schema.ts';
import {
	SearchParams,
	type SearchParamText,
} from '#lib/routing/search-params.svelte.ts';
import { cn } from '#lib/utils/utils.ts';

const params = new SearchParams(sandboxListSchema);
const text = (key: SandboxTextFilterKey): SearchParamText =>
	params.text(key, { clears: ['cursor'] });
const texts = {
	minCpu: text('minCpu'),
	maxCpu: text('maxCpu'),
	minMemory: text('minMemory'),
	maxMemory: text('maxMemory'),
	minDisk: text('minDisk'),
	maxDisk: text('maxDisk'),
	createdAtAfter: text('createdAtAfter'),
	createdAtBefore: text('createdAtBefore'),
	lastEventAfter: text('lastEventAfter'),
	lastEventBefore: text('lastEventBefore'),
	labels: text('labels'),
};

const snapshotsQuery = createQuery(() => allSnapshotsQueryOptions());
const locationsQuery = createQuery(() => machineLocationsQueryOptions());

let moreOpen = $state(hasActiveMoreFilters(params.current));

const snapshotOptions = $derived(
	(snapshotsQuery.data ?? []).map((snapshot) => ({
		value: snapshot.name,
		label: snapshot.name,
	}))
);
const locationFilterOptions = $derived(
	locationOptions(locationsQuery.data?.continents ?? [])
);
const quickFields = $derived<ResourceQuickFilterField[]>([
	{
		id: 'state',
		label: 'State',
		options: STATE_OPTIONS,
		values: params.current.state,
		onChange: (values) =>
			filter({
				state: values.filter(isSandboxState),
				view: SandboxView.All,
			}),
	},
	{
		id: 'class',
		label: 'Class',
		options: CLASS_OPTIONS,
		values: params.current.class,
		onChange: (values) => filter({ class: values.filter(isSandboxClass) }),
	},
	{
		id: 'location',
		label: 'Location',
		options: locationFilterOptions,
		values: params.current.location,
		onChange: (location) => filter({ location }),
	},
]);

function filter(patch: Partial<SandboxListValues>): void {
	void params.update({ ...patch, cursor: undefined });
}
</script>

{#snippet dateRange(after: DateField, before: DateField)}
	<div class="grid gap-2">
		<ChipInput
			aria-label="After"
			type="datetime-local"
			bind:value={texts[after].value}
		/>
		<ChipInput
			aria-label="Before"
			type="datetime-local"
			bind:value={texts[before].value}
		/>
	</div>
{/snippet}

<ResourceFilterPanel {quickFields}>
	<div class="-mx-2 flex flex-col">
		<button
			type="button"
			aria-expanded={moreOpen}
			class={cn(
				MENU_ROW_BASE_CLASS,
				MENU_ROW_SIZES.md,
				'w-full hover-hover:bg-surface-hover focus-visible:bg-surface-hover'
			)}
			onclick={() => (moreOpen = !moreOpen)}
		>
			<span>More filters</span>
			<ChevronRight
				class={cn(
					'ml-auto transition-transform duration-(--motion-quick)',
					moreOpen && 'rotate-90'
				)}
			/>
		</button>
	</div>
	{#if moreOpen}
		<ResourceFilterField label="Snapshot">
			<ChipDropdown
				multiple
				searchable
				fullWidth
				align="start"
				aria-label="Filter by snapshot"
				options={snapshotOptions}
				value={params.current.snapshot}
				onChange={(snapshot) => filter({ snapshot })}
			/>
		</ResourceFilterField>
		<ResourceFilterField label="Recoverable">
			<ChipDropdown
				fullWidth
				align="start"
				aria-label="Filter by recoverability"
				options={BOOLEAN_OPTIONS}
				value={booleanFilterValue(params.current.recoverable)}
				onChange={(value: string) =>
					filter({ recoverable: parseBooleanFilter(value) })}
			/>
		</ResourceFilterField>
		<ResourceFilterField label="Resources">
			<div class="grid grid-cols-2 gap-2">
				{#each RESOURCE_RANGE_FIELDS as field (field.key)}
					<ChipInput
						aria-label={field.label}
						min={MINIMUM_RESOURCE_FILTER}
						type="number"
						placeholder={field.placeholder}
						bind:value={texts[field.key].value}
					/>
				{/each}
			</div>
		</ResourceFilterField>
		<ResourceFilterField label="Created">
			{@render dateRange('createdAtAfter', 'createdAtBefore')}
		</ResourceFilterField>
		<ResourceFilterField label="Last event">
			{@render dateRange('lastEventAfter', 'lastEventBefore')}
		</ResourceFilterField>
		<ResourceFilterField label="Labels">
			<ChipTextarea
				aria-label="Filter by labels"
				placeholder={LABELS_PLACEHOLDER}
				bind:value={texts.labels.value}
			/>
		</ResourceFilterField>
		<ResourceFilterToggle
			label="Include errored deletions"
			checked={params.current.includeErroredDeleted}
			onCheckedChange={(includeErroredDeleted) =>
				filter({ includeErroredDeleted })}
		/>
	{/if}
	{#if hasActiveSandboxFilters(params.current)}
		<button
			type="button"
			class="flex h-8 w-full cursor-pointer items-center justify-center rounded-md text-(--text-secondary) text-xs transition-colors duration-(--motion-quick) hover-hover:bg-surface-hover"
			onclick={() =>
				void params.update(clearedSandboxParams(SANDBOX_FILTER_KEYS))}
		>
			Clear all filters
		</button>
	{/if}
</ResourceFilterPanel>
