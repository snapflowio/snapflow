<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const BRAND_MARK_SIZE = 24;
const EXTERNAL_TARGET = '_blank';
const EXTERNAL_REL = 'noopener noreferrer';
const SUPPORT_LABEL = 'Support';
const DOCUMENTATION_LABEL = 'Documentation';
</script>

<script lang="ts">
import ArrowLeft from '@lucide/svelte/icons/arrow-left';
import BookOpen from '@lucide/svelte/icons/book-open';
import LifeBuoy from '@lucide/svelte/icons/life-buoy';
import { getWebsiteLinks } from '#lib/api/public-config.ts';
import BrandMark from '#lib/components/brand-mark.svelte';
import { SUPPORT_HREF } from '#lib/config/support.ts';
import {
	SIDEBAR_COLLAPSIBLE,
	SIDEBAR_FOOTER_ICON_CLASS,
	SIDEBAR_FOOTER_LABEL_CLASS,
	SIDEBAR_FOOTER_LINK_CLASS,
	SIDEBAR_ITEM_CLASS,
	SIDEBAR_ITEM_ICON_CLASS,
} from '#lib/features/dashboard/lib/sidebar-constants.ts';
import { getDashboardMode } from '#lib/features/dashboard/state/dashboard-mode.svelte.ts';
import { getDashboardNavigation } from '#lib/features/dashboard/state/dashboard-navigation.svelte.ts';
import { getSidebar } from '#lib/features/dashboard/state/sidebar.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { cn } from '#lib/utils/utils.ts';
import { resolve } from '$app/paths';
import SidebarAccountMenu from './sidebar-account-menu.svelte';
import SidebarFind from './sidebar-find.svelte';
import SidebarNav from './sidebar-nav.svelte';
import SidebarOrgSwitcher from './sidebar-org-switcher.svelte';
import SidebarTooltip from './sidebar-tooltip.svelte';
import SidebarTrigger from './sidebar-trigger.svelte';

const navigation = getDashboardNavigation();
const mode = getDashboardMode();
const sidebar = getSidebar();
const { docsHref } = getWebsiteLinks();
const area = $derived(navigation.area);
</script>

<aside
	aria-label="Sidebar"
	data-state={sidebar.state}
	data-collapsible={sidebar.collapsed ? SIDEBAR_COLLAPSIBLE : undefined}
	class="flex h-full w-full min-w-0 flex-col overflow-hidden bg-bg"
>
	<div
		class="flex shrink-0 flex-row items-center justify-between p-2 md:pt-3.5 in-data-[collapsible=icon]:flex-col in-data-[collapsible=icon]:items-start in-data-[collapsible=icon]:gap-2"
	>
		<a
			href={resolve(Path.DASHBOARD)}
			aria-label="Snapflow"
			class="ml-1 flex shrink-0 items-center outline-none transition-opacity focus-visible:opacity-70"
		>
			<BrandMark size={BRAND_MARK_SIZE} />
		</a>
		<div
			class="flex items-center gap-2 animate-in fade-in-0 duration-1000 motion-reduce:animate-none in-data-[collapsible=icon]:flex-col"
		>
			<SidebarFind />
			{#if !sidebar.isMobile}
				<SidebarTrigger />
			{/if}
		</div>
	</div>
	<div class="shrink-0 px-2 pt-2">
		<SidebarOrgSwitcher />
	</div>
	{#if area}
		<div class="shrink-0 px-2 pt-2">
			<SidebarTooltip label={area.label}>
				{#snippet child({ props })}
					<a
						{...props}
						href={navigation.modeLanding(mode.current)}
						class={cn(
							SIDEBAR_ITEM_CLASS,
							'gap-4 text-(--text-primary) duration-75 hover-hover:bg-surface-1'
						)}
					>
						<ArrowLeft aria-hidden="true" class={SIDEBAR_ITEM_ICON_CLASS} />
						<span class="min-w-0 truncate">{area.label}</span>
					</a>
				{/snippet}
			</SidebarTooltip>
		</div>
	{/if}
	<SidebarNav />
	<div class="flex shrink-0 flex-col gap-2 p-2">
		{#if !area}
			<SidebarTooltip label={SUPPORT_LABEL}>
				{#snippet child({ props })}
					<a {...props} href={SUPPORT_HREF} class={SIDEBAR_FOOTER_LINK_CLASS}>
						<LifeBuoy aria-hidden="true" class={SIDEBAR_FOOTER_ICON_CLASS} />
						<span class={SIDEBAR_FOOTER_LABEL_CLASS}>{SUPPORT_LABEL}</span>
					</a>
				{/snippet}
			</SidebarTooltip>
			<SidebarTooltip label={DOCUMENTATION_LABEL}>
				{#snippet child({ props })}
					<a
						{...props}
						href={docsHref}
						target={EXTERNAL_TARGET}
						rel={EXTERNAL_REL}
						class={SIDEBAR_FOOTER_LINK_CLASS}
					>
						<BookOpen aria-hidden="true" class={SIDEBAR_FOOTER_ICON_CLASS} />
						<span class={SIDEBAR_FOOTER_LABEL_CLASS}
							>{DOCUMENTATION_LABEL}</span
						>
					</a>
				{/snippet}
			</SidebarTooltip>
			<div aria-hidden="true" class="h-px w-full shrink-0 bg-border"></div>
		{/if}
		<SidebarAccountMenu />
	</div>
</aside>
