<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { Snippet } from 'svelte';
import type { HeaderAction } from '#lib/components/page/header-actions.ts';
import type { ResourceCrumb } from './resource-breadcrumbs.svelte';
import type { ResourceRowAction } from './resource-row-action.ts';
import type { ResourceTab } from './resource-tabs.svelte';

interface ResourceDetailShellProps {
	breadcrumbs: readonly ResourceCrumb[];
	crumbActions?: readonly ResourceRowAction[];
	status?: Snippet;
	tabs: readonly ResourceTab[];
	actions?: readonly HeaderAction[];
	trailing?: Snippet;
	aside?: Snippet;
	asideTitle?: string;
	children: Snippet;
}
</script>

<script lang="ts">
import { MediaQuery } from 'svelte/reactivity';
import { breakpointQuery } from '#lib/components/layouts/breakpoints.ts';
import Resource from './resource.svelte';
import ResourceDetailPanes from './resource-detail-panes.svelte';
import ResourceHeader from './resource-header.svelte';
import ResourceTabs from './resource-tabs.svelte';

let {
	breadcrumbs,
	crumbActions,
	status,
	tabs,
	actions,
	trailing,
	aside,
	asideTitle = 'Overview',
	children,
}: ResourceDetailShellProps = $props();

const isDesktop = new MediaQuery(breakpointQuery('lg'));
const title = $derived(breadcrumbs.at(-1)?.label ?? '');
const tabsLabel = $derived(`${title} sections`);
const contentTabs = $derived(Boolean(aside));
</script>

{#snippet content()}
	{#if contentTabs}
		<div
			class="flex min-h-10 shrink-0 items-center border-border border-b px-4 py-1.5"
		>
			<ResourceTabs {tabs} label={tabsLabel} />
		</div>
	{/if}
	{@render children()}
{/snippet}

<Resource>
	<ResourceHeader
		{breadcrumbs}
		{crumbActions}
		{status}
		tabs={contentTabs ? undefined : tabs}
		{tabsLabel}
		{actions}
		{trailing}
	/>
	<main class="flex min-h-0 flex-1 flex-col overflow-hidden">
		{#if aside && isDesktop.current}
			<ResourceDetailPanes {aside} {asideTitle}>
				{@render content()}
			</ResourceDetailPanes>
		{:else}
			{@render content()}
		{/if}
	</main>
</Resource>
