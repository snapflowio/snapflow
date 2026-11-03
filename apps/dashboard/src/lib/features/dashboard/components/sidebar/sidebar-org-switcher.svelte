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

const BRAND_MARK_SIZE = 16;
const MENU_SIDE_OFFSET = 8;
const SWITCH_ORGANIZATION_LABEL = 'Switch organization';

function compareOrganizations(
	left: AuthOrganization,
	right: AuthOrganization
): number {
	if (left.personal !== right.personal) return left.personal ? -1 : 1;
	return left.name.localeCompare(right.name);
}

interface SidebarOrgSwitcherProps {
	collapsed: boolean;
	onExpand: () => void;
}
</script>

<script lang="ts">
import ChevronDown from '@lucide/svelte/icons/chevron-down';
import PanelLeft from '@lucide/svelte/icons/panel-left';
import Plus from '@lucide/svelte/icons/plus';
import { createMutation } from '@tanstack/svelte-query';
import { setActiveOrganizationMutationOptions } from '#lib/api/auth/organization.ts';
import BrandMark from '#lib/components/brand-mark.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import {
	chipIconSlotClass,
	IDENTITY_TILE_CLASS,
} from '#lib/components/ui/chip/chip-chrome.ts';
import DropdownMenu from '#lib/components/ui/dropdown-menu/dropdown-menu.svelte';
import DropdownMenuContent from '#lib/components/ui/dropdown-menu/dropdown-menu-content.svelte';
import DropdownMenuItem from '#lib/components/ui/dropdown-menu/dropdown-menu-item.svelte';
import DropdownMenuSeparator from '#lib/components/ui/dropdown-menu/dropdown-menu-separator.svelte';
import DropdownMenuTrigger from '#lib/components/ui/dropdown-menu/dropdown-menu-trigger.svelte';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import { SIDEBAR_RAIL_CHIP_CLASS } from '#lib/features/dashboard/lib/sidebar-constants.ts';
import CreateOrganizationModal from '#lib/features/organizations/components/create-organization-modal.svelte';
import { Path } from '#lib/routing/paths.ts';
import { cn } from '#lib/utils/utils.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

let { collapsed, onExpand }: SidebarOrgSwitcherProps = $props();

const auth = getAuth();
let createOpen = $state(false);
const organizations = $derived(
	auth.organizations.toSorted(compareOrganizations)
);
const active = $derived(auth.activeOrganization);
const switchOrganization = createMutation(() => ({
	...setActiveOrganizationMutationOptions(),
	onSuccess: async () => {
		await auth.refetch();
		await goto(resolve(Path.DASHBOARD));
	},
}));
</script>

{#snippet brandTile()}
	<div class="flex size-4 shrink-0 items-center justify-center text-brand">
		<BrandMark size={BRAND_MARK_SIZE} />
	</div>
{/snippet}

<div class="min-w-0 flex-1">
	{#if collapsed}
		<Chip
			aria-label="Expand sidebar"
			fullWidth
			class={SIDEBAR_RAIL_CHIP_CLASS}
			onclick={onExpand}
		>
			{#snippet left()}
				<div class="relative flex size-4 shrink-0 items-center justify-center">
					<div class="group-hover:invisible">{@render brandTile()}</div>
					<PanelLeft
						aria-hidden="true"
						class="pointer-events-none invisible absolute inset-0 m-auto size-4 rotate-180 text-(--text-icon) group-hover:visible"
					/>
				</div>
			{/snippet}
		</Chip>
	{:else}
		<DropdownMenu>
			<DropdownMenuTrigger>
				{#snippet child({
					props,
				})}
					<Chip
						{...props}
						aria-label={SWITCH_ORGANIZATION_LABEL}
						aria-busy={switchOrganization.isPending || undefined}
						class="min-w-0 max-w-full"
					>
						{#snippet left()}
							{@render brandTile()}
						{/snippet}
						{#snippet right()}
							<span class={cn(chipIconSlotClass, 'text-(--text-icon)')}>
								<ChevronDown class="size-3.5" />
							</span>
						{/snippet}
						{active?.name ?? SWITCH_ORGANIZATION_LABEL}
					</Chip>
				{/snippet}
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				side="bottom"
				sideOffset={MENU_SIDE_OFFSET}
				class="flex max-h-[var(--bits-dropdown-menu-content-available-height,400px)] w-64 max-w-[calc(100vw-24px)] flex-col overflow-y-auto"
			>
				<div class="flex max-h-50 flex-col gap-0.5 overflow-y-auto">
					{#each organizations as organization (organization.id)}
						<DropdownMenuItem
							size="lg"
							active={organization.id === active?.id}
							disabled={switchOrganization.isPending}
							onSelect={() => {
								if (organization.id !== active?.id) {
									switchOrganization.mutate(organization.id);
								}
							}}
						>
							<div class={IDENTITY_TILE_CLASS}>
								{organization.name.charAt(0)}
							</div>
							<span>{organization.name}</span>
						</DropdownMenuItem>
					{/each}
				</div>
				<DropdownMenuSeparator />
				<DropdownMenuItem size="lg" onSelect={() => (createOpen = true)}>
					<Plus />
					<span>New organization</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	{/if}
</div>
<CreateOrganizationModal bind:open={createOpen} />
