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
import type { ClassValue } from 'svelte/elements';
import type { HeaderAction } from './header-actions.ts';
import type { PageBack, PageTitleSize } from './page-header-bar.svelte';
import type { PageWidth } from './page-layout.ts';

interface PageColumnProps {
	children: Snippet;
	class?: ClassValue;
	wide?: boolean;
	width?: PageWidth;
	title?: string;
	titleSize?: PageTitleSize;
	info?: string;
	back?: PageBack;
	leading?: Snippet;
	actions?: readonly HeaderAction[];
	trailing?: Snippet;
	pending?: boolean;
}

const NARROW_WIDTHS: ReadonlySet<PageWidth> = new Set(['settings', 'narrow']);
</script>

<script lang="ts">
import PageBanner from '#lib/components/page-banner/page-banner.svelte';
import { cn } from '#lib/utils/utils.ts';
import PageHeaderBar from './page-header-bar.svelte';
import {
	PAGE_BODY_COLUMN_CLASS,
	PAGE_BODY_CONTENT_CLASS,
	PAGE_BODY_EMBEDDED_CLASS,
	PAGE_BODY_SCROLL_CLASS,
	PAGE_WIDTH_CLASS,
} from './page-layout.ts';
import { hasPageScrollOwner } from './page-scroll-context.ts';

let {
	children,
	class: className,
	wide = false,
	width = 'page',
	title,
	titleSize,
	info,
	back,
	leading,
	actions,
	trailing,
	pending = false,
}: PageColumnProps = $props();

const embedded = hasPageScrollOwner();
const resolvedWidth = $derived<PageWidth>(wide ? 'wide' : width);

const hasHeader = $derived(
	Boolean(title || leading || back || trailing || actions?.length)
);
</script>

{#snippet column()}
	<div class={cn(PAGE_BODY_COLUMN_CLASS, PAGE_WIDTH_CLASS[resolvedWidth])}>
		{#if hasHeader}
			<PageHeaderBar
				{title}
				{titleSize}
				{info}
				{back}
				{leading}
				{actions}
				{trailing}
				{pending}
			/>
		{/if}
		<div class={cn(PAGE_BODY_CONTENT_CLASS, 'gap-8', className)}>
			<PageBanner />
			{@render children()}
		</div>
	</div>
{/snippet}

<div class={embedded ? PAGE_BODY_EMBEDDED_CLASS : PAGE_BODY_SCROLL_CLASS}>
	{#if embedded && NARROW_WIDTHS.has(resolvedWidth)}
		<div class={cn('flex w-full flex-col', PAGE_WIDTH_CLASS.page)}>
			{@render column()}
		</div>
	{:else}
		{@render column()}
	{/if}
</div>
