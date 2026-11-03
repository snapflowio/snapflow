<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { IconComponent } from '#lib/components/icons/icon-component.ts';
import type { ResourceRowAction } from './resource-row-action.ts';

export interface ResourceCrumb {
	label: string;
	href?: string;
	icon?: IconComponent;
}

interface ResourceBreadcrumbsProps {
	crumbs: readonly ResourceCrumb[];
	actions?: readonly ResourceRowAction[];
}
</script>

<script lang="ts">
import ChevronDown from '@lucide/svelte/icons/chevron-down';
import Chip from '#lib/components/ui/chip/chip.svelte';
import {
	chipContentIconClass,
	chipGeometryClass,
	chipIconSlotClass,
} from '#lib/components/ui/chip/chip-chrome.ts';
import DropdownMenu from '#lib/components/ui/dropdown-menu/dropdown-menu.svelte';
import DropdownMenuContent from '#lib/components/ui/dropdown-menu/dropdown-menu-content.svelte';
import DropdownMenuTrigger from '#lib/components/ui/dropdown-menu/dropdown-menu-trigger.svelte';
import OverflowText from '#lib/components/ui/overflow/overflow-text.svelte';
import { cn } from '#lib/utils/utils.ts';
import ResourceRowActionItems from './resource-row-action-items.svelte';

let { crumbs, actions = [] }: ResourceBreadcrumbsProps = $props();

const visibleActions = $derived(
	actions.filter((action) => action.visible !== false)
);
const lastIndex = $derived(crumbs.length - 1);
</script>

{#snippet separator()}
	<span
		aria-hidden="true"
		class="mx-0.5 shrink-0 select-none text-(--text-icon) text-sm"
		>/</span
	>
{/snippet}

<nav aria-label="Breadcrumb" class="flex min-w-0 items-center">
	<ol class="flex min-w-0 items-center">
		{#each crumbs as crumb, index (`${index}-${crumb.label}`)}
			{const current = $derived(index === lastIndex)}
			<li
				class={cn(
					'flex min-w-0 items-center',
					current ? 'max-w-[56%] shrink' : 'max-w-[34%] shrink-[2]',
					!current && index > 0 && 'max-md:hidden'
				)}
				aria-current={current ? 'page' : undefined}
			>
				{#if index > 0}
					{@render separator()}
				{/if}
				{#if current && visibleActions.length > 0}
					<DropdownMenu>
						<DropdownMenuTrigger>
							{#snippet child({
								props,
							})}
								<Chip {...props} leftIcon={crumb.icon} class="min-w-0">
									{#snippet right()}
										<span class={cn(chipIconSlotClass, 'text-(--text-icon)')}>
											<ChevronDown class="size-3.5" />
										</span>
									{/snippet}
									{crumb.label}
								</Chip>
							{/snippet}
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start">
							<ResourceRowActionItems actions={visibleActions} />
						</DropdownMenuContent>
					</DropdownMenu>
				{:else if crumb.href && !current}
					<Chip href={crumb.href} leftIcon={crumb.icon} class="min-w-0">
						{crumb.label}
					</Chip>
				{:else}
					<span
						class={cn(
							'inline-flex min-w-0 text-(--text-body)',
							chipGeometryClass
						)}
					>
						{#if crumb.icon}
							<crumb.icon class={chipContentIconClass} />
						{/if}
						<OverflowText text={crumb.label} class="text-sm" />
					</span>
				{/if}
			</li>
		{/each}
	</ol>
</nav>
