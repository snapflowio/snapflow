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

export type ResourceBreadcrumbsVariant = 'trail' | 'title';

interface ResourceBreadcrumbsProps {
	crumbs: readonly ResourceCrumb[];
	actions?: readonly ResourceRowAction[];
	variant?: ResourceBreadcrumbsVariant;
}

const PARENT_CRUMB_CLASS =
	'inline-flex min-w-0 items-center gap-2 rounded-md text-(--text-subtle) text-sm outline-none transition-colors duration-(--motion-quick) hover-hover:text-(--text-primary) focus-visible:focus-ring';
const CURRENT_CRUMB_CLASS: Record<ResourceBreadcrumbsVariant, string> = {
	trail:
		'inline-flex min-w-0 items-center gap-2 text-(--text-primary) text-base',
	title:
		'inline-flex min-w-0 items-center gap-2 whitespace-nowrap heading-xs text-(--text-primary)',
};
</script>

<script lang="ts">
import ChevronDown from '@lucide/svelte/icons/chevron-down';
import Chip from '#lib/components/ui/chip/chip.svelte';
import { chipIconSlotClass } from '#lib/components/ui/chip/chip-chrome.ts';
import DropdownMenu from '#lib/components/ui/dropdown-menu/dropdown-menu.svelte';
import DropdownMenuContent from '#lib/components/ui/dropdown-menu/dropdown-menu-content.svelte';
import DropdownMenuTrigger from '#lib/components/ui/dropdown-menu/dropdown-menu-trigger.svelte';
import OverflowText from '#lib/components/ui/overflow/overflow-text.svelte';
import { cn } from '#lib/utils/utils.ts';
import ResourceRowActionItems from './resource-row-action-items.svelte';

let {
	crumbs,
	actions = [],
	variant = 'trail',
}: ResourceBreadcrumbsProps = $props();

const visibleActions = $derived(
	actions.filter((action) => action.visible !== false)
);
const lastIndex = $derived(crumbs.length - 1);
const singleCrumb = $derived(lastIndex === 0);
</script>

{#snippet separator()}
	<span
		aria-hidden="true"
		class="mx-2 shrink-0 select-none text-(--text-disabled) text-sm"
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
					current && singleCrumb && 'max-w-full',
					current && !singleCrumb && 'max-w-[56%] shrink',
					!current && 'max-w-[34%] shrink-[2]',
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
							{#snippet child({ props })}
								<Chip
									{...props}
									size="compact"
									leftIcon={crumb.icon}
									class={cn(
										'-ml-3 min-w-0',
										variant === 'title'
											? 'h-10 text-xl md:text-2xl font-normal'
											: 'text-sm'
									)}
								>
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
					<a href={crumb.href} class={PARENT_CRUMB_CLASS}>
						{#if crumb.icon}
							<crumb.icon class="size-4 shrink-0" />
						{/if}
						<OverflowText text={crumb.label} />
					</a>
				{:else}
					<span
						class={current ? CURRENT_CRUMB_CLASS[variant] : PARENT_CRUMB_CLASS}
					>
						{#if crumb.icon}
							<crumb.icon class="size-4 shrink-0 text-(--text-muted)" />
						{/if}
						<OverflowText text={crumb.label} />
					</span>
				{/if}
			</li>
		{/each}
	</ol>
</nav>
