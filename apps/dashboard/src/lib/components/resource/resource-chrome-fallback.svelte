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
	columns?: readonly string[];
}

const PENDING_CRUMB_LABEL = '…';
const FIRST_COLUMN_WEIGHT = 2.5;
const noop = () => {};
</script>

<script lang="ts">
import Search from '@lucide/svelte/icons/search';
import Resource from './resource.svelte';
import ResourceHeader from './resource-header.svelte';

let {
	icon,
	title,
	breadcrumbs,
	tabs,
	actions = [],
	createLabel,
	searchPlaceholder,
	columns = [],
}: ResourceChromeFallbackProps = $props();

const pendingCrumbs = $derived(
	breadcrumbs ? [...breadcrumbs, { label: PENDING_CRUMB_LABEL }] : undefined
);
const inertActions = $derived(
	actions.map((action) => ({
		...action,
		href: undefined,
		onSelect: noop,
		disabled: true,
	}))
);
const gridTemplateColumns = $derived(
	columns
		.map((_, index) => `minmax(0, ${index === 0 ? FIRST_COLUMN_WEIGHT : 1}fr)`)
		.join(' ')
);
</script>

<Resource aria-busy="true">
	<ResourceHeader
		{icon}
		{title}
		breadcrumbs={pendingCrumbs}
		{tabs}
		actions={inertActions}
		create={createLabel
			? { label: createLabel, onSelect: noop, disabled: true }
			: undefined}
	/>
	{#if searchPlaceholder}
		<div
			class="flex shrink-0 items-center gap-1.5 border-border border-b px-4 py-2.5 md:px-6"
		>
			<Search class="size-3.5 shrink-0 text-(--text-muted)" />
			<span class="py-1 text-(--text-muted) text-sm">{searchPlaceholder}</span>
		</div>
	{/if}
	{#if columns.length > 0}
		<div
			aria-hidden="true"
			class="grid shrink-0 border-border border-b"
			style:grid-template-columns={gridTemplateColumns}
		>
			{#each columns as column (column)}
				<div
					class="flex h-10 items-center px-3 text-(--text-muted) text-small md:px-6"
				>
					{column}
				</div>
			{/each}
		</div>
	{/if}
	<span role="status" class="sr-only">Loading</span>
</Resource>
