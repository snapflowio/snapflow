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

interface SettingsResourceRowBase {
	title: string;
	description?: string;
	icon?: IconComponent;
	tile?: Snippet;
	badge?: Snippet;
	trailing?: Snippet;
}

interface SettingsResourceRowLink extends SettingsResourceRowBase {
	href: string;
	onSelect?: undefined;
	clickLabel?: string;
}

interface SettingsResourceRowButton extends SettingsResourceRowBase {
	onSelect: () => void;
	href?: undefined;
	clickLabel: string;
}

interface SettingsResourceRowStatic extends SettingsResourceRowBase {
	href?: undefined;
	onSelect?: undefined;
	clickLabel?: undefined;
}

export type SettingsResourceRowProps =
	| SettingsResourceRowLink
	| SettingsResourceRowButton
	| SettingsResourceRowStatic;
</script>

<script lang="ts">
import ArrowRight from '@lucide/svelte/icons/arrow-right';
import { RESOURCE_TILE_CLASS } from '#lib/components/ui/chip/chip-chrome.ts';
import { cn } from '#lib/utils/utils.ts';

let {
	title,
	description,
	icon: Icon,
	tile,
	badge,
	trailing,
	href,
	onSelect,
	clickLabel,
}: SettingsResourceRowProps = $props();

const activatable = $derived(href !== undefined || onSelect !== undefined);
const stretchedClass =
	"after:absolute after:inset-0 after:rounded-lg after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-[color-mix(in_srgb,var(--text-muted)_30%,transparent)] outline-none";
</script>

<div
	class={cn(
		'-mx-2 flex items-center justify-between gap-2.5 rounded-lg p-2',
		activatable &&
			'group relative transition-colors hover-hover:bg-surface-active'
	)}
>
	<div class="flex min-w-0 items-center gap-2.5">
		{#if tile}
			{@render tile()}
		{:else if Icon}
			<div class={RESOURCE_TILE_CLASS}><Icon /></div>
		{/if}
		<div class="flex min-w-0 flex-col gap-px">
			{#if href !== undefined}
				<a
					{href}
					aria-label={clickLabel}
					class={cn('truncate text-(--text-body) text-sm', stretchedClass)}
				>
					{title}
				</a>
			{:else if onSelect}
				<button
					type="button"
					aria-label={clickLabel}
					onclick={onSelect}
					class={cn(
						'cursor-pointer truncate text-left text-(--text-body) text-sm',
						stretchedClass
					)}
				>
					{title}
				</button>
			{:else}
				<span class="truncate text-(--text-body) text-sm">{title}</span>
			{/if}
			{#if description}
				<span class="truncate text-(--text-muted) text-caption">
					{description}
				</span>
			{/if}
		</div>
	</div>
	<div class="relative z-1 flex shrink-0 items-center gap-2">
		{@render badge?.()}
		{@render trailing?.()}
		{#if activatable && !trailing}
			<ArrowRight class="size-4 text-(--text-icon)" />
		{/if}
	</div>
</div>
