<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { AuthOrganization } from '#lib/api/auth/organization.ts';

const SWITCH_ORGANIZATION_LABEL = 'Switch organization';
const MENU_ITEM_SIZE = 'lg';
const MENU_SIDE = 'bottom';
const MENU_ALIGN = 'start';
const MENU_COLLAPSED_SIDE = 'right';
const MENU_COLLAPSED_ALIGN = 'start';

function compareOrganizations(
	left: AuthOrganization,
	right: AuthOrganization
): number {
	if (left.personal !== right.personal) return left.personal ? -1 : 1;
	return left.name.localeCompare(right.name);
}

function matchesFilter(organization: AuthOrganization, filter: string) {
	return organization.name.toLowerCase().includes(filter);
}
</script>

<script lang="ts">
import Plus from '@lucide/svelte/icons/plus';
import { createMutation } from '@tanstack/svelte-query';
import { watch } from 'runed';
import { setActiveOrganizationMutationOptions } from '#lib/api/auth/organization.ts';
import DropdownMenu from '#lib/components/ui/dropdown-menu/dropdown-menu.svelte';
import DropdownMenuContent from '#lib/components/ui/dropdown-menu/dropdown-menu-content.svelte';
import DropdownMenuItem from '#lib/components/ui/dropdown-menu/dropdown-menu-item.svelte';
import DropdownMenuRadioGroup from '#lib/components/ui/dropdown-menu/dropdown-menu-radio-group.svelte';
import DropdownMenuRadioItem from '#lib/components/ui/dropdown-menu/dropdown-menu-radio-item.svelte';
import DropdownMenuSearchInput from '#lib/components/ui/dropdown-menu/dropdown-menu-search-input.svelte';
import DropdownMenuSeparator from '#lib/components/ui/dropdown-menu/dropdown-menu-separator.svelte';
import { MENU_LABEL_CLASS } from '#lib/components/ui/dropdown-menu/dropdown-menu-styles.ts';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import {
	ORG_SEARCH_THRESHOLD,
	SIDEBAR_MENU_CONTENT_CLASS,
	SIDEBAR_MENU_ICON_SLOT_CLASS,
	SIDEBAR_MENU_ITEM_CLASS,
} from '#lib/features/dashboard/lib/sidebar-constants.ts';
import { DASHBOARD_ITEM_ICONS } from '#lib/features/dashboard/state/dashboard-navigation.svelte.ts';
import { getSidebar } from '#lib/features/dashboard/state/sidebar.svelte.ts';
import { Path, resolvePath } from '#lib/routing/paths.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import SidebarAvatar from './sidebar-avatar.svelte';
import SidebarMenuTrigger from './sidebar-menu-trigger.svelte';

const SettingsIcon = DASHBOARD_ITEM_ICONS.settings;

const auth = getAuth();
const sidebar = getSidebar();
let menuOpen = $state(false);
let filter = $state('');
let createOpen = $state(false);
let createModal = $state.raw<Promise<
	typeof import('#lib/features/organizations/components/create-organization-modal.svelte')
> | null>(null);

const organizations = $derived(
	auth.organizations.toSorted(compareOrganizations)
);
const searchable = $derived(organizations.length > ORG_SEARCH_THRESHOLD);
const normalizedFilter = $derived(filter.trim().toLowerCase());
const shownOrganizations = $derived(
	normalizedFilter
		? organizations.filter((organization) =>
				matchesFilter(organization, normalizedFilter)
			)
		: organizations
);
const active = $derived(auth.activeOrganization);
const activeName = $derived(active?.name ?? SWITCH_ORGANIZATION_LABEL);

watch(
	() => menuOpen,
	(open) => {
		if (!open) filter = '';
	},
	{ lazy: true }
);

const switchOrganization = createMutation(() => ({
	...setActiveOrganizationMutationOptions(),
	onSuccess: async () => {
		await auth.refetch();
		await goto(resolve(Path.DASHBOARD));
	},
}));

function selectOrganization(organizationId: string): void {
	if (organizationId !== active?.id) {
		switchOrganization.mutate(organizationId);
	}
}

function openCreate(): void {
	createModal ??= import(
		'#lib/features/organizations/components/create-organization-modal.svelte'
	);
	createOpen = true;
}
</script>

<DropdownMenu bind:open={menuOpen}>
	<SidebarMenuTrigger
		name={activeName}
		label={`${SWITCH_ORGANIZATION_LABEL}, ${activeName}`}
		busy={switchOrganization.isPending}
	/>
	<DropdownMenuContent
		align={sidebar.collapsed ? MENU_COLLAPSED_ALIGN : MENU_ALIGN}
		side={sidebar.collapsed ? MENU_COLLAPSED_SIDE : MENU_SIDE}
		class={SIDEBAR_MENU_CONTENT_CLASS}
	>
		{#if searchable}
			<DropdownMenuSearchInput
				bind:value={filter}
				placeholder="Filter organizations"
				aria-label="Filter organizations"
			/>
		{/if}
		<DropdownMenuRadioGroup
			aria-label={SWITCH_ORGANIZATION_LABEL}
			value={active?.id ?? ''}
			onValueChange={selectOrganization}
			class="flex max-h-60 flex-col overflow-y-auto"
		>
			{#each shownOrganizations as organization (organization.id)}
				<DropdownMenuRadioItem
					value={organization.id}
					size={MENU_ITEM_SIZE}
					class={SIDEBAR_MENU_ITEM_CLASS}
					disabled={switchOrganization.isPending}
				>
					<SidebarAvatar name={organization.name} />
					<span class={MENU_LABEL_CLASS}>{organization.name}</span>
				</DropdownMenuRadioItem>
			{:else}
				{#if normalizedFilter}
					<p class="px-2 py-1.5 text-(--text-subtle) text-sm">
						No organizations match "{filter.trim()}"
					</p>
				{/if}
			{/each}
		</DropdownMenuRadioGroup>
		<DropdownMenuSeparator />
		<DropdownMenuItem
			size={MENU_ITEM_SIZE}
			class={SIDEBAR_MENU_ITEM_CLASS}
			onSelect={openCreate}
		>
			<span class={SIDEBAR_MENU_ICON_SLOT_CLASS}>
				<Plus aria-hidden="true" />
			</span>
			<span class={MENU_LABEL_CLASS}>New organization</span>
		</DropdownMenuItem>
		<DropdownMenuItem size={MENU_ITEM_SIZE} class={SIDEBAR_MENU_ITEM_CLASS}>
			{#snippet child({ props })}
				<a {...props} href={resolvePath(Path.SETTINGS)}>
					<span class={SIDEBAR_MENU_ICON_SLOT_CLASS}>
						<SettingsIcon aria-hidden="true" />
					</span>
					<span class={MENU_LABEL_CLASS}>Organization settings</span>
				</a>
			{/snippet}
		</DropdownMenuItem>
	</DropdownMenuContent>
</DropdownMenu>
{#if createModal}
	{#await createModal then { default: CreateOrganizationModal }}
		<CreateOrganizationModal bind:open={createOpen} />
	{/await}
{/if}
