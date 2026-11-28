<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import Plus from '@lucide/svelte/icons/plus';
import type { Snippet } from 'svelte';
import type { IconComponent } from '#lib/components/icons/icon-component.ts';
import type { HeaderAction } from '#lib/components/page/header-actions.ts';
import type { ResourceCrumb } from './resource-breadcrumbs.svelte';
import type {
	ResourceFilterConfig,
	ResourceSearchConfig,
	ResourceSortConfig,
} from './resource-options.ts';
import type { ResourceRowAction } from './resource-row-action.ts';
import type { ResourceTab } from './resource-tabs.svelte';

export interface ResourceCreateAction {
	label: string;
	onSelect?: () => void;
	disabled?: boolean;
	disabledReason?: string;
}

export interface ResourceHeaderProps {
	icon?: IconComponent;
	title?: string;
	breadcrumbs?: readonly ResourceCrumb[];
	crumbActions?: readonly ResourceRowAction[];
	status?: Snippet;
	tabs?: readonly ResourceTab[];
	tabsLabel?: string;
	search?: ResourceSearchConfig;
	filter?: ResourceFilterConfig;
	sort?: ResourceSortConfig;
	actions?: readonly HeaderAction[];
	create?: ResourceCreateAction;
	trailing?: Snippet;
	info?: string;
	pending?: boolean;
}

type ToolbarMenu = 'filter' | 'sort';

const CREATE_ACTION_ID = 'create';

export function createHeaderAction(create: ResourceCreateAction): HeaderAction {
	return {
		id: CREATE_ACTION_ID,
		kind: 'primary',
		label: create.label,
		icon: Plus,
		onSelect: create.onSelect,
		disabled: create.disabled,
		disabledReason: create.disabledReason,
	};
}
</script>

<script lang="ts">
import { MediaQuery } from 'svelte/reactivity';
import { breakpointQuery } from '#lib/components/layouts/breakpoints.ts';
import HeaderActionCluster from '#lib/components/page/header-action-cluster.svelte';
import HeaderPendingBar from '#lib/components/page/header-pending-bar.svelte';
import InfoTooltip from '#lib/components/page/info-tooltip.svelte';
import { pageHeaderStart } from '#lib/components/page/page-header-start.svelte.ts';
import {
	PAGE_TOOLBAR_CLASS,
	PAGE_TOOLBAR_TITLE_CLASS,
} from '#lib/components/page/page-layout.ts';
import ChipSwitch, {
	type ChipSwitchOption,
} from '#lib/components/ui/chip/chip-switch.svelte';
import { cn } from '#lib/utils/utils.ts';
import { goto } from '$app/navigation';
import ResourceFilterControl from './filter/resource-filter-control.svelte';
import ResourceBreadcrumbs from './resource-breadcrumbs.svelte';
import ResourceSearchField from './resource-search-field.svelte';
import ResourceSortMenu from './resource-sort-menu.svelte';

let {
	icon: Icon,
	title,
	breadcrumbs,
	crumbActions,
	status,
	tabs,
	tabsLabel,
	search,
	filter,
	sort,
	actions = [],
	create,
	trailing,
	info,
	pending = false,
}: ResourceHeaderProps = $props();

let openMenu = $state<ToolbarMenu | null>(null);
const isDesktop = new MediaQuery(breakpointQuery('md'));

$effect(() => pageHeaderStart.claim());

const visibleTabs = $derived(
	(tabs ?? []).filter((tab) => tab.visible !== false)
);
const hasTabs = $derived(visibleTabs.length > 0);
const viewOptions = $derived<ChipSwitchOption[]>(
	visibleTabs.map((tab) => ({
		value: tab.href,
		label: tab.label,
		count: tab.count,
	}))
);
const activeView = $derived(visibleTabs.find((tab) => tab.active)?.href ?? '');
const allActions = $derived<readonly HeaderAction[]>(
	create ? [...actions, createHeaderAction(create)] : actions
);
const primaryActions = $derived(
	allActions.filter((action) => action.kind === 'primary')
);
const secondaryActions = $derived(
	allActions.filter((action) => action.kind !== 'primary')
);
const hasControls = $derived(
	Boolean(search || trailing || filter || (sort && !isDesktop.current)) ||
		secondaryActions.length > 0
);

function menuOpenChange(menu: ToolbarMenu) {
	return (open: boolean) => {
		if (open) openMenu = menu;
		else if (openMenu === menu) openMenu = null;
	};
}
</script>

{#snippet controls()}
	{#if search}
		<ResourceSearchField
			value={search.value}
			onValueChange={search.onChange}
			placeholder={search.placeholder}
			aria-label={search.ariaLabel ?? search.placeholder}
			class="md:max-w-76 md:flex-[1_1_10rem]"
		/>
	{/if}
	{@render trailing?.()}
	{#if filter}
		<ResourceFilterControl
			{filter}
			open={openMenu === 'filter'}
			onOpenChange={menuOpenChange('filter')}
		/>
	{/if}
	{#if sort && !isDesktop.current}
		<ResourceSortMenu
			{sort}
			open={openMenu === 'sort'}
			onOpenChange={menuOpenChange('sort')}
		/>
	{/if}
{/snippet}

<header class={cn(PAGE_TOOLBAR_CLASS, '@container/toolbar flex-wrap gap-y-2')}>
	<div
		class="flex min-w-0 max-w-full shrink-0 items-center gap-x-4 @max-2xl/toolbar:basis-full @max-2xl/toolbar:flex-wrap @max-2xl/toolbar:gap-y-2"
	>
		{@render pageHeaderStart.content?.()}
		{#if breadcrumbs && breadcrumbs.length > 0}
			<ResourceBreadcrumbs crumbs={breadcrumbs} actions={crumbActions} />
		{:else if title}
			<h1
				class={cn(PAGE_TOOLBAR_TITLE_CLASS, 'flex shrink-0 items-center gap-2')}
			>
				{#if Icon}
					<Icon class="size-4 shrink-0 text-(--text-muted)" />
				{/if}
				{title}
			</h1>
		{/if}
		{#if info}
			<InfoTooltip content={info} />
		{/if}
		{@render status?.()}
		{#if primaryActions.length > 0}
			<HeaderActionCluster
				actions={primaryActions}
				size="compact"
				class="ml-auto @2xl/toolbar:hidden"
			/>
		{/if}
		{#if hasTabs}
			<div class="@max-2xl/toolbar:basis-full">
				<ChipSwitch
					size="compact"
					options={viewOptions}
					value={activeView}
					onChange={(href) => goto(href)}
					aria-label={tabsLabel ?? `${title ?? 'Page'} views`}
				/>
			</div>
		{/if}
	</div>
	<div
		class={cn(
			'flex min-w-0 flex-1 basis-0 items-center justify-end gap-2 @max-2xl/toolbar:basis-full @max-2xl/toolbar:flex-wrap @max-2xl/toolbar:justify-start',
			!hasControls && '@max-2xl/toolbar:hidden'
		)}
	>
		<HeaderActionCluster
			actions={secondaryActions}
			leading={controls}
			size="compact"
			class="contents"
		/>
		{#if primaryActions.length > 0}
			<HeaderActionCluster
				actions={primaryActions}
				size="compact"
				class="shrink-0 @max-2xl/toolbar:hidden"
			/>
		{/if}
	</div>
	<HeaderPendingBar {pending} />
</header>
