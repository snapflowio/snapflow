<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { ScopeResource } from '#lib/features/organizations/lib/organization-resources.ts';

const READ_ACTION = 'read';
const INDETERMINATE = 'indeterminate';

type AccessLevel = 'read' | 'write' | 'none' | 'custom';

const LEVEL_OPTIONS = [
	{ value: 'read', label: 'Read' },
	{ value: 'write', label: 'Write' },
] as const;

interface ApiKeyScopePickerProps {
	resources: readonly ScopeResource[];
	value: readonly string[];
	onChange: (permissions: string[]) => void;
	isGrantable: (resource: string, action: string) => boolean;
	label?: string;
}
</script>

<script lang="ts">
import ChevronRight from '@lucide/svelte/icons/chevron-right';
import Search from '@lucide/svelte/icons/search';
import { SvelteSet } from 'svelte/reactivity';
import Checkbox from '#lib/components/ui/checkbox/checkbox.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipSwitch from '#lib/components/ui/chip/chip-switch.svelte';
import IconButton from '#lib/components/ui/icon-button.svelte';
import Label from '#lib/components/ui/label.svelte';
import { permissionKey } from '#lib/features/organizations/lib/organization-resources.ts';
import { cn } from '#lib/utils/utils.ts';

let {
	resources,
	value,
	onChange,
	isGrantable,
	label = 'Permissions',
}: ApiKeyScopePickerProps = $props();

const pickerId = $props.id();
const expanded = new SvelteSet<string>();
let search = $state('');

const selected = $derived(new Set(value));
const query = $derived(search.trim().toLowerCase());
const shownResources = $derived(
	resources.filter(
		(entry) =>
			!query ||
			entry.label.toLowerCase().includes(query) ||
			entry.actions.some((action) => action.includes(query))
	)
);

function grantableActions(entry: ScopeResource): string[] {
	return entry.actions.filter((action) => isGrantable(entry.resource, action));
}

function selectedActions(entry: ScopeResource): string[] {
	return entry.actions.filter((action) =>
		selected.has(permissionKey(entry.resource, action))
	);
}

function withResource(entry: ScopeResource, actions: readonly string[]) {
	const others = value.filter(
		(key) =>
			!entry.actions.some(
				(action) => permissionKey(entry.resource, action) === key
			)
	);
	return [
		...others,
		...actions.map((action) => permissionKey(entry.resource, action)),
	];
}

function checkedState(entry: ScopeResource): boolean | typeof INDETERMINATE {
	const chosen = selectedActions(entry).length;
	if (chosen === 0) return false;
	return chosen === grantableActions(entry).length ? true : INDETERMINATE;
}

function accessLevel(entry: ScopeResource): AccessLevel {
	const chosen = selectedActions(entry);
	if (chosen.length === 0) return 'none';
	if (chosen.length === grantableActions(entry).length) return 'write';
	if (chosen.length === 1 && chosen[0] === READ_ACTION) return 'read';
	return 'custom';
}

function hasLevels(entry: ScopeResource): boolean {
	const grantable = grantableActions(entry);
	return grantable.includes(READ_ACTION) && grantable.length > 1;
}

function toggleResource(entry: ScopeResource): void {
	const everything = checkedState(entry) === true;
	onChange(withResource(entry, everything ? [] : grantableActions(entry)));
}

function setLevel(entry: ScopeResource, level: AccessLevel): void {
	if (level === 'read') onChange(withResource(entry, [READ_ACTION]));
	if (level === 'write') onChange(withResource(entry, grantableActions(entry)));
}

function toggleAction(entry: ScopeResource, action: string, on: boolean) {
	const current = new Set(selectedActions(entry));
	if (on) {
		current.add(action);
		if (action !== READ_ACTION && entry.actions.includes(READ_ACTION)) {
			current.add(READ_ACTION);
		}
	} else {
		current.delete(action);
	}
	onChange(withResource(entry, [...current]));
}

function readLocked(entry: ScopeResource, action: string): boolean {
	return (
		action === READ_ACTION &&
		selectedActions(entry).some((chosen) => chosen !== READ_ACTION)
	);
}

function toggleExpanded(resource: string): void {
	if (expanded.has(resource)) expanded.delete(resource);
	else expanded.add(resource);
}
</script>

<fieldset
	class="m-0 flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-surface-3 p-0"
>
	<legend class="sr-only">{label}</legend>
	<div
		class="flex min-h-12 flex-wrap items-center gap-2 border-border border-b px-4 py-2"
	>
		<span class="font-medium text-(--text-subtle) text-xs"
			>{label}
			· {value.length} selected</span
		>
		{#if value.length > 0}
			<Chip size="compact" onclick={() => onChange([])}>Clear</Chip>
		{/if}
		<ChipInput
			icon={Search}
			bind:value={search}
			placeholder="Search permissions"
			aria-label="Search permissions"
			class="ml-auto w-full sm:w-56"
		/>
	</div>
	<ul class="divide-y divide-border">
		{#each shownResources as entry (entry.resource)}
			{const grantable = $derived(grantableActions(entry))}
			{const open = $derived(expanded.has(entry.resource) || query.length > 0)}
			{const rowId = $derived(`${pickerId}-${entry.resource}`)}
			<li class="flex flex-col">
				<div class="flex min-h-12 items-center gap-2 px-4 py-2">
					<IconButton
						variant="ghost"
						icon={ChevronRight}
						label={open ? `Collapse ${entry.label}` : `Expand ${entry.label}`}
						tooltip={false}
						aria-expanded={open}
						class={cn(
							'shrink-0 [&_svg]:transition-transform [&_svg]:duration-(--motion-quick)',
							open && '[&_svg]:rotate-90'
						)}
						onclick={() => toggleExpanded(entry.resource)}
					/>
					<Checkbox
						id={rowId}
						checked={checkedState(entry)}
						disabled={grantable.length === 0}
						aria-label={`Grant every ${entry.label} permission`}
						onCheckedChange={() => toggleResource(entry)}
					/>
					<Label for={rowId} class="min-w-0 truncate">{entry.label}</Label>
					<span class="shrink-0 font-mono text-(--text-muted) text-xs">
						{selectedActions(entry).length}/{entry.actions.length}
					</span>
					{#if hasLevels(entry)}
						<ChipSwitch
							size="compact"
							class="ml-auto"
							aria-label={`${entry.label} access`}
							options={LEVEL_OPTIONS}
							value={accessLevel(entry)}
							onChange={(level) => setLevel(entry, level)}
						/>
					{/if}
				</div>
				{#if open}
					<div class="flex flex-wrap gap-x-5 gap-y-2 pr-4 pb-3 pl-18">
						{#each entry.actions as action (action)}
							{const actionId = $derived(`${rowId}-${action}`)}
							{const granted = $derived(isGrantable(entry.resource, action))}
							<span class="inline-flex items-center gap-1.5">
								<Checkbox
									id={actionId}
									size="sm"
									checked={selected.has(permissionKey(entry.resource, action))}
									disabled={!granted || readLocked(entry, action)}
									onCheckedChange={(checked) =>
										toggleAction(entry, action, checked === true)}
								/>
								<Label
									for={actionId}
									class={cn(
										'font-mono text-xs',
										!granted && 'text-(--text-disabled)'
									)}
								>
									{action}
								</Label>
							</span>
						{/each}
					</div>
				{/if}
			</li>
		{:else}
			<li class="px-4 py-6 text-center text-(--text-muted) text-sm">
				No permissions match "{search.trim()}"
			</li>
		{/each}
	</ul>
</fieldset>
