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
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';

interface SettingsResourceRowBase {
	title: string;
	meta?: string | Snippet;
	icon?: IconComponent;
	tile?: Snippet;
	badge?: Snippet;
	trailing?: Snippet;
	dimmed?: boolean;
}

interface SettingsResourceRowLink extends SettingsResourceRowBase {
	href: string;
	onSelect?: undefined;
	clickLabel?: string;
	actions?: undefined;
}

interface SettingsResourceRowButton extends SettingsResourceRowBase {
	onSelect: () => void;
	href?: undefined;
	clickLabel: string;
	actions?: undefined;
}

interface SettingsResourceRowStatic extends SettingsResourceRowBase {
	href?: undefined;
	onSelect?: undefined;
	clickLabel?: undefined;
	actions?: readonly ResourceRowAction[];
	actionsLabel?: string;
}

export type SettingsResourceRowProps =
	| SettingsResourceRowLink
	| SettingsResourceRowButton
	| SettingsResourceRowStatic;
</script>

<script lang="ts">
import ChevronRight from '@lucide/svelte/icons/chevron-right';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';

import { cn } from '#lib/utils/utils.ts';

let props: SettingsResourceRowProps = $props();
const {
	title,
	meta,
	icon: Icon,
	tile,
	badge,
	trailing,
	dimmed = false,
	href,
	onSelect,
	clickLabel,
} = $derived(props);
const rowActions = $derived(
	props.href === undefined && props.onSelect === undefined
		? props.actions
		: undefined
);
const rowActionsLabel = $derived(
	props.href === undefined && props.onSelect === undefined
		? (props.actionsLabel ?? `${props.title} actions`)
		: ''
);

const activatable = $derived(href !== undefined || onSelect !== undefined);
const wrapsTrailing = $derived(
	trailing !== undefined || (rowActions?.length ?? 0) > 0
);
const stretchedClass =
	"after:absolute after:inset-0 after:content-[''] focus-visible:after:focus-ring-inset outline-none";
</script>

<div
	data-settings-row=""
	class={cn(
		'flex items-center justify-between gap-x-6 gap-y-3',
		wrapsTrailing && 'max-sm:flex-wrap',
		dimmed && 'opacity-50',
		activatable &&
			'group relative transition-colors duration-(--motion-quick) hover-hover:bg-surface-3'
	)}
>
	<div class="flex min-w-0 items-center gap-4">
		{#if tile}
			{@render tile()}
		{:else if Icon}
			<Icon class="size-4 shrink-0 self-center text-(--text-muted)" />
		{/if}
		<div class="flex min-w-0 flex-col gap-1">
			{#if href !== undefined}
				<a
					{href}
					aria-label={clickLabel}
					class={cn(
						'truncate font-medium text-(--text-primary) text-sm',
						stretchedClass
					)}
				>
					{title}
				</a>
			{:else if onSelect}
				<button
					type="button"
					aria-label={clickLabel}
					onclick={onSelect}
					class={cn(
						'cursor-pointer truncate text-left font-medium text-(--text-primary) text-sm',
						stretchedClass
					)}
				>
					{title}
				</button>
			{:else}
				<span class="truncate font-medium text-(--text-primary) text-sm"
					>{title}</span
				>
			{/if}
			{#if meta}
				<span
					class="line-clamp-2 text-pretty text-(--text-muted) text-sm"
					title={typeof meta === 'string' ? meta : undefined}
				>
					{#if typeof meta === 'string'}
						{meta}
					{:else}
						{@render meta()}
					{/if}
				</span>
			{/if}
		</div>
	</div>
	<div class="relative z-1 flex shrink-0 items-center gap-2">
		{@render badge?.()}
		{@render trailing?.()}
		{#if rowActions && rowActions.length > 0}
			<ResourceRowActions
				reveal="always"
				label={rowActionsLabel}
				actions={rowActions}
			/>
		{/if}
		{#if activatable && !trailing}
			<ChevronRight class="size-4 text-(--text-subtle)" />
		{/if}
	</div>
</div>
