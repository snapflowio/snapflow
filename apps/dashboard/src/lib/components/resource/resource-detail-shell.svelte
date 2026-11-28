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
	info?: string;
	pending?: boolean;
	canWrite?: boolean;
	children: Snippet;
}

const SETTINGS_TAB_LABEL = 'Settings';
const HISTORY_TAB_LABELS: ReadonlySet<string> = new Set([
	'Activity',
	'Audit',
	'Deliveries',
	'Events',
	'History',
	'Logs',
]);

const TAB_RANK = { work: 0, history: 1, settings: 2 } as const;

function tabRank(tab: ResourceTab): number {
	if (tab.label === SETTINGS_TAB_LABEL) return TAB_RANK.settings;
	return HISTORY_TAB_LABELS.has(tab.label) ? TAB_RANK.history : TAB_RANK.work;
}

export function orderDetailTabs(
	tabs: readonly ResourceTab[],
	canWrite: boolean
): ResourceTab[] {
	return tabs
		.filter((tab) => canWrite || tab.label !== SETTINGS_TAB_LABEL)
		.map((tab, index) => ({ tab, index }))
		.sort(
			(left, right) =>
				tabRank(left.tab) - tabRank(right.tab) || left.index - right.index
		)
		.map(({ tab }) => tab);
}
</script>

<script lang="ts">
import PanelRight from '@lucide/svelte/icons/panel-right';
import { MediaQuery } from 'svelte/reactivity';
import { breakpointQuery } from '#lib/components/layouts/breakpoints.ts';
import InfoTooltip from '#lib/components/page/info-tooltip.svelte';
import { useDashboardAside } from '#lib/components/page/page-aside.svelte.ts';
import PageHeaderBar, {
	type PageBack,
} from '#lib/components/page/page-header-bar.svelte';
import { PAGE_CARD_SCROLL_CLASS } from '#lib/components/page/page-layout.ts';
import { providePageScrollOwner } from '#lib/components/page/page-scroll-context.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Resource from './resource.svelte';
import ResourceBreadcrumbs from './resource-breadcrumbs.svelte';
import ResourceDetailsPanel from './resource-details-panel.svelte';
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
	info,
	pending = false,
	canWrite = true,
	children,
}: ResourceDetailShellProps = $props();

const isDesktop = new MediaQuery(breakpointQuery('xl'));
const current = $derived(breadcrumbs.at(-1));
const title = $derived(current?.label ?? '');
const currentCrumb = $derived<readonly ResourceCrumb[]>(
	current ? [current] : []
);
const back = $derived.by((): PageBack | undefined => {
	const parent = breadcrumbs.at(-2);
	return parent?.href ? { label: parent.label, href: parent.href } : undefined;
});
const tabsLabel = $derived(`${title} sections`);
const orderedTabs = $derived(orderDetailTabs(tabs, canWrite));
let overviewOpen = $state(false);

providePageScrollOwner();

useDashboardAside(() =>
	aside && isDesktop.current
		? { label: asideTitle, variant: 'context', content: aside }
		: null
);
</script>

{#snippet main()}
	<div class={PAGE_CARD_SCROLL_CLASS}>
		<div class="flex shrink-0 justify-center px-4 pt-8 pb-4 md:px-8">
			<div class="flex w-full max-w-[1280px] flex-col gap-6">
				<PageHeaderBar {back} {actions} {trailing} {pending}>
					{#snippet leading()}
						<div class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
							<ResourceBreadcrumbs
								variant="title"
								crumbs={currentCrumb}
								actions={crumbActions}
							/>
							{@render status?.()}
							{#if info}
								<InfoTooltip content={info} />
							{/if}
						</div>
					{/snippet}
				</PageHeaderBar>
				{#if orderedTabs.length > 0 || (aside && !isDesktop.current)}
					<div class="flex min-w-0 items-end gap-4">
						<ResourceTabs tabs={orderedTabs} label={tabsLabel} />
						{#if aside && !isDesktop.current}
							<Chip
								variant="secondary"
								size="compact"
								leftIcon={PanelRight}
								class="ml-auto shrink-0"
								onclick={() => (overviewOpen = true)}
							>
								{asideTitle}
							</Chip>
						{/if}
					</div>
				{/if}
			</div>
		</div>
		<div class="flex flex-1 flex-col">
			{@render children()}
		</div>
	</div>
{/snippet}

<Resource>
	<h1 class="sr-only">{title}</h1>
	{@render main()}
	{#if aside && !isDesktop.current}
		<ResourceDetailsPanel
			open={overviewOpen}
			title={asideTitle}
			onClose={() => (overviewOpen = false)}
		>
			{@render aside()}
		</ResourceDetailsPanel>
	{/if}
</Resource>
