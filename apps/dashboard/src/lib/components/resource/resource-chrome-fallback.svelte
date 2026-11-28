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
import type { HeaderAction } from '#lib/components/page/header-actions.ts';
import type { ResourceCrumb } from './resource-breadcrumbs.svelte';
import type { ResourceTab } from './resource-tabs.svelte';

interface ResourceChromeFallbackProps {
	icon?: IconComponent;
	title?: string;
	breadcrumbs?: readonly ResourceCrumb[];
	tabs?: readonly ResourceTab[];
	actions?: readonly HeaderAction[];
	createLabel?: string;
	searchPlaceholder?: string;
	hasFilter?: boolean;
	hasSort?: boolean;
	columns?: readonly string[];
}

const PENDING_TABS_LABEL = 'Sections';
</script>

<script lang="ts">
import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down';
import ListFilter from '@lucide/svelte/icons/list-filter';
import Search from '@lucide/svelte/icons/search';
import PageHeaderBar, {
	type PageBack,
} from '#lib/components/page/page-header-bar.svelte';
import { PAGE_CARD_SCROLL_CLASS } from '#lib/components/page/page-layout.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Skeleton from '#lib/components/ui/skeleton/skeleton.svelte';
import Resource from './resource.svelte';
import { orderDetailTabs } from './resource-detail-shell.svelte';
import ResourceHeader from './resource-header.svelte';
import ResourceTabs from './resource-tabs.svelte';
import {
	buildGridTemplateColumns,
	resourceHeaderCellClass,
	resourceTableHeaderClass,
} from './table/resource-table.ts';
import ResourceTableSkeleton from './table/resource-table-skeleton.svelte';

let {
	icon,
	title,
	breadcrumbs,
	tabs,
	actions = [],
	createLabel,
	searchPlaceholder,
	hasFilter = false,
	hasSort = false,
	columns = [],
}: ResourceChromeFallbackProps = $props();

const detailBack = $derived.by((): PageBack | undefined => {
	const parent = breadcrumbs?.at(-1);
	return parent?.href ? { label: parent.label, href: parent.href } : undefined;
});
const inertActions = $derived(
	actions.map((action) => ({
		...action,
		href: undefined,
		onSelect: undefined,
		disabled: true,
	}))
);
const gridTemplateColumns = $derived(
	buildGridTemplateColumns(columns.map((column) => ({ id: column })))
);
const hasOptions = $derived(
	searchPlaceholder !== undefined || hasFilter || hasSort
);
</script>

{#if breadcrumbs}
	<Resource aria-busy="true">
		<div class={PAGE_CARD_SCROLL_CLASS}>
			<div class="flex shrink-0 justify-center px-4 pt-8 pb-4 md:px-8">
				<div class="flex w-full max-w-[1280px] flex-col gap-6">
					<PageHeaderBar back={detailBack} actions={inertActions}>
						{#snippet leading()}
							<div class="heading-xs">
								<Skeleton decorative class="h-[1.375em] w-48 rounded-lg" />
							</div>
						{/snippet}
					</PageHeaderBar>
					{#if tabs && tabs.length > 0}
						<ResourceTabs
							tabs={orderDetailTabs(tabs, true)}
							label={PENDING_TABS_LABEL}
						/>
					{/if}
				</div>
			</div>
		</div>
		<span role="status" class="sr-only">Loading</span>
	</Resource>
{:else}
	<Resource aria-busy="true">
		<ResourceHeader
			{icon}
			{title}
			{tabs}
			actions={inertActions}
			create={createLabel ? { label: createLabel, disabled: true } : undefined}
		/>
		{#if hasOptions}
			<div
				aria-hidden="true"
				class="flex min-h-14 shrink-0 items-center gap-4 border-border border-b px-4 py-3"
			>
				{#if searchPlaceholder !== undefined}
					<div
						class="flex h-8 w-full items-center gap-2 rounded-full border border-border bg-surface-3 pl-3 sm:w-76"
					>
						<Search class="size-3.5 shrink-0 text-(--text-muted)" />
						<span class="text-(--text-subtle) text-sm"
							>{searchPlaceholder}</span
						>
					</div>
				{/if}
				<div class="ml-auto flex items-center gap-2">
					{#if hasFilter}
						<Chip size="compact" leftIcon={ListFilter} tabindex={-1}
							>Filter</Chip
						>
					{/if}
					{#if hasSort}
						<Chip size="compact" leftIcon={ArrowUpDown} tabindex={-1}
							>Sort</Chip
						>
					{/if}
				</div>
			</div>
		{/if}
		{#if columns.length > 0}
			<div
				aria-hidden="true"
				class={resourceTableHeaderClass}
				style:grid-template-columns={gridTemplateColumns}
			>
				{#each columns as column (column)}
					<div class={resourceHeaderCellClass}>{column}</div>
				{/each}
			</div>
			<ResourceTableSkeleton
				{gridTemplateColumns}
				columnCount={columns.length}
			/>
		{/if}
		<span role="status" class="sr-only">Loading</span>
	</Resource>
{/if}
