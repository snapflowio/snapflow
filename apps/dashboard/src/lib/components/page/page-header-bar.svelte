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
import type { HeaderAction } from './header-actions.ts';

export type PageBack =
	| { label: string; href: string; onSelect?: undefined }
	| { label: string; onSelect: () => void; href?: undefined };

export type PageTitleSize = 'page' | 'detail';

export interface PageHeaderBarProps {
	title?: string;
	titleSize?: PageTitleSize;
	info?: string;
	back?: PageBack;
	leading?: Snippet;
	actions?: readonly HeaderAction[];
	trailing?: Snippet;
	pending?: boolean;
}

const BACK_LINK_CLASS =
	'inline-flex w-fit items-center gap-1.5 rounded-md text-(--text-subtle) text-sm outline-none transition-colors duration-(--motion-quick) hover-hover:text-(--text-primary) focus-visible:focus-ring';
</script>

<script lang="ts">
import ArrowLeft from '@lucide/svelte/icons/arrow-left';
import { cn } from '#lib/utils/utils.ts';
import HeaderActionCluster from './header-action-cluster.svelte';
import HeaderPendingBar from './header-pending-bar.svelte';
import InfoTooltip from './info-tooltip.svelte';
import { pageHeaderStart } from './page-header-start.svelte.ts';
import {
	PAGE_DETAIL_TITLE_CLASS,
	PAGE_HEADER_ROW_CLASS,
	PAGE_TITLE_CLASS,
} from './page-layout.ts';

let {
	title,
	titleSize = 'page',
	info,
	back,
	leading,
	actions,
	trailing,
	pending = false,
}: PageHeaderBarProps = $props();

const TITLE_CLASS = {
	page: PAGE_TITLE_CLASS,
	detail: PAGE_DETAIL_TITLE_CLASS,
} as const satisfies Record<PageTitleSize, string>;

$effect(() => pageHeaderStart.claim());
</script>

{#snippet backLink()}
	{#if back?.href !== undefined}
		<a href={back.href} class={BACK_LINK_CLASS}>
			<ArrowLeft class="size-4 shrink-0" />
			{back.label}
		</a>
	{:else if back}
		<button
			type="button"
			class={cn(BACK_LINK_CLASS, 'cursor-pointer')}
			onclick={back.onSelect}
		>
			<ArrowLeft class="size-4 shrink-0" />
			{back.label}
		</button>
	{/if}
{/snippet}

<header class="relative flex flex-col gap-y-3">
	{@render backLink()}
	<div class={PAGE_HEADER_ROW_CLASS}>
		<div class="flex min-w-0 max-w-full items-center gap-x-4">
			{@render pageHeaderStart.content?.()}
			{#if title}
				<h1 class={TITLE_CLASS[titleSize]}>{title}</h1>
			{/if}
			{#if info}
				<InfoTooltip content={info} />
			{/if}
			{@render leading?.()}
		</div>
		<HeaderActionCluster {actions} leading={trailing} class="md:shrink-0" />
	</div>
	<HeaderPendingBar {pending} />
</header>
