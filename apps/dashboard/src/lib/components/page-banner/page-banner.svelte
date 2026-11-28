<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import CircleInfo from '@lucide/svelte/icons/info';
import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
import type { IconComponent } from '#lib/components/icons/icon-component.ts';
import type {
	PageBannerItem,
	PageBannerVariant,
} from './page-banner-state.svelte.ts';

export type PageBannerPlacement = 'page' | 'shell';

const VARIANT_ICON = {
	default: CircleInfo,
	destructive: TriangleAlert,
} as const satisfies Record<PageBannerVariant, IconComponent>;

const VARIANT_ICON_CLASS = {
	default: 'text-(--accent)',
	destructive: 'text-(--text-error)',
} as const satisfies Record<PageBannerVariant, string>;

const LIVE_REGIONS = [
	{ role: 'status', variant: 'default' },
	{ role: 'alert', variant: 'destructive' },
] as const satisfies readonly {
	role: 'status' | 'alert';
	variant: PageBannerVariant;
}[];

const ACTION_CLASS = 'shrink-0 @max-md:w-full @max-md:justify-center';
const MESSAGE_SEPARATOR = '·';

interface PageBannerProps {
	placement?: PageBannerPlacement;
}
</script>

<script lang="ts">
import { prefersReducedMotion } from 'svelte/motion';
import { fade, slide } from 'svelte/transition';
import Chip from '#lib/components/ui/chip/chip.svelte';
import {
	easeStandard,
	MotionToken,
	motionDuration,
} from '#lib/components/ui/motion.ts';
import PageBannerCountdown from './page-banner-countdown.svelte';
import { pageBanner } from './page-banner-state.svelte.ts';

let { placement = 'page' }: PageBannerProps = $props();

const banner = $derived(pageBanner.current);

$effect(() => {
	if (placement !== 'page') return undefined;
	return pageBanner.claim();
});

function reveal(node: Element) {
	const duration = motionDuration(MotionToken.STANDARD);
	return prefersReducedMotion.current
		? fade(node, { duration })
		: slide(node, { duration, easing: easeStandard });
}
</script>

{#snippet card(item: PageBannerItem)}
	{const Icon = $derived(VARIANT_ICON[item.variant])}
	<div
		class="@container flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-xl border border-(--border-subtle) bg-surface-1 px-6 py-4 text-sm"
	>
		<div class="flex min-w-0 flex-1 items-start gap-3">
			<Icon
				aria-hidden="true"
				class={['mt-0.5 size-4 shrink-0', VARIANT_ICON_CLASS[item.variant]]}
			/>
			<p class="flex min-w-0 flex-wrap items-baseline gap-x-1.5 leading-5">
				<span class="text-(--text-primary)">{item.message}</span>
				{#if item.countdown}
					<span aria-hidden="true" class="text-(--text-subtle)">
						{MESSAGE_SEPARATOR}
					</span>
					<PageBannerCountdown countdown={item.countdown} />
				{/if}
				{#if item.description}
					<span class="text-(--text-subtle)">{item.description}</span>
				{/if}
			</p>
		</div>
		{#if item.action}
			{#if 'href' in item.action}
				<Chip
					variant="secondary"
					size="compact"
					class={ACTION_CLASS}
					href={item.action.href}
				>
					{item.action.label}
				</Chip>
			{:else}
				<Chip
					variant="secondary"
					size="compact"
					class={ACTION_CLASS}
					disabled={item.action.disabled}
					loading={item.action.loading}
					onclick={item.action.onSelect}
				>
					{item.action.label}
				</Chip>
			{/if}
		{/if}
	</div>
{/snippet}

{#if placement === 'page'}
	{#if banner}
		<div class="shrink-0" transition:reveal>{@render card(banner)}</div>
	{/if}
{:else}
	{#each LIVE_REGIONS as region (region.role)}
		<div role={region.role} aria-atomic="true" class="shrink-0">
			{#if banner?.variant === region.variant}
				{#if pageBanner.claimed}
					<span class="sr-only">
						{[banner.message, banner.description].filter(Boolean).join(' ')}
					</span>
				{:else}
					<div class="px-4 pt-4 md:px-8" transition:reveal>
						{@render card(banner)}
					</div>
				{/if}
			{/if}
		</div>
	{/each}
{/if}
