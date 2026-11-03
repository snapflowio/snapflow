<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { ChipOption } from './chip-selection.ts';

interface ChipOptionListProps<T extends string = string> {
	options: readonly ChipOption<T>[];
	selectedValues: readonly T[];
	onSelect: (option: ChipOption<T>, event: Event) => void;
	showSelectedCheck?: boolean;
	allLabel?: string;
	onSelectAll?: (event: Event) => void;
	searchable?: boolean;
	searchPlaceholder?: string;
}
</script>

<script lang="ts" generics="T extends string = string">
import Check from '@lucide/svelte/icons/check';
import { getDropdownMenuRoot } from '#lib/components/ui/dropdown-menu/dropdown-menu-context.ts';
import DropdownMenuItem from '#lib/components/ui/dropdown-menu/dropdown-menu-item.svelte';
import DropdownMenuSearchInput from '#lib/components/ui/dropdown-menu/dropdown-menu-search-input.svelte';
import { filterOptions } from './chip-selection.ts';

let {
	options,
	selectedValues,
	onSelect,
	showSelectedCheck = false,
	allLabel,
	onSelectAll,
	searchable = false,
	searchPlaceholder = 'Search...',
}: ChipOptionListProps<T> = $props();

const root = getDropdownMenuRoot();
let search = $state('');
const visibleOptions = $derived(
	searchable ? filterOptions(options, search) : options
);

function handleSearchKeydown(event: KeyboardEvent): void {
	if (event.key === 'Escape') root.close();
}
</script>

{#snippet selectedCheck()}
	<Check class="ml-auto" />
{/snippet}

{#if searchable}
	<DropdownMenuSearchInput
		placeholder={searchPlaceholder}
		bind:value={search}
		onkeydown={handleSearchKeydown}
	/>
{/if}

{#if allLabel !== undefined}
	<DropdownMenuItem onSelect={onSelectAll}>
		<span>{allLabel}</span>
		{#if showSelectedCheck && selectedValues.length === 0}
			{@render selectedCheck()}
		{/if}
	</DropdownMenuItem>
{/if}

{#each visibleOptions as option (option.value)}
	<DropdownMenuItem
		disabled={option.disabled}
		onSelect={(event: Event) => onSelect(option, event)}
	>
		{#if option.icon}
			<option.icon />
		{/if}
		<span>{option.label}</span>
		{#if showSelectedCheck && selectedValues.includes(option.value)}
			{@render selectedCheck()}
		{/if}
	</DropdownMenuItem>
{:else}
	<div class="px-2 py-4 text-center text-(--text-muted) text-small">
		No results
	</div>
{/each}
