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
import type { IconComponent } from '#lib/components/icons/icon-component.ts';
import type { HeaderAction } from '#lib/components/page/header-actions.ts';
import type { ResourceCrumb } from './resource-breadcrumbs.svelte';
import type { ResourceRowAction } from './resource-row-action.ts';
import type { ResourceTab } from './resource-tabs.svelte';

export interface ResourceCreateAction {
	label: string;
	onSelect: () => void;
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
	actions?: readonly HeaderAction[];
	create?: ResourceCreateAction;
	trailing?: Snippet;
}

const CREATE_ACTION_ID = 'create';
</script>

<script lang="ts">
import Plus from '@lucide/svelte/icons/plus';
import HeaderActionCluster from '#lib/components/page/header-action-cluster.svelte';
import {
	chipContentIconClass,
	chipGeometryClass,
	RESOURCE_HEADER_BAR_CLASS,
} from '#lib/components/ui/chip/chip-chrome.ts';
import { cn } from '#lib/utils/utils.ts';
import ResourceBreadcrumbs from './resource-breadcrumbs.svelte';
import ResourceTabs from './resource-tabs.svelte';

let {
	icon: Icon,
	title,
	breadcrumbs,
	crumbActions,
	status,
	tabs,
	tabsLabel,
	actions = [],
	create,
	trailing,
}: ResourceHeaderProps = $props();

const allActions = $derived<readonly HeaderAction[]>(
	create
		? [
				...actions,
				{
					id: CREATE_ACTION_ID,
					kind: 'primary',
					label: create.label,
					icon: Plus,
					onSelect: create.onSelect,
					disabled: create.disabled,
					disabledReason: create.disabledReason,
					mobileIconOnly: true,
				},
			]
		: actions
);
</script>

<header class={RESOURCE_HEADER_BAR_CLASS}>
	<div
		class="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 md:flex-nowrap md:gap-3"
	>
		<div
			class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden max-md:min-w-min"
		>
			{#if breadcrumbs && breadcrumbs.length > 0}
				<ResourceBreadcrumbs crumbs={breadcrumbs} actions={crumbActions} />
			{:else if title}
				<div
					class={cn('inline-flex shrink-0 cursor-default', chipGeometryClass)}
				>
					{#if Icon}
						<Icon class={chipContentIconClass} />
					{/if}
					<h1 class="block whitespace-nowrap text-(--text-body) text-sm">
						{title}
					</h1>
				</div>
			{/if}
			{@render status?.()}
			{#if tabs && tabs.length > 0}
				<span
					aria-hidden="true"
					class="mx-2 h-4 w-px shrink-0 bg-border"
				></span>
				<ResourceTabs {tabs} label={tabsLabel ?? `${title ?? 'Page'} views`} />
			{/if}
		</div>
		<HeaderActionCluster
			actions={allActions}
			leading={trailing}
			class="ml-auto max-w-full shrink-0"
		/>
	</div>
</header>
