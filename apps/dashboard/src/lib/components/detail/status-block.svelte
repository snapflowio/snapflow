<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
export type StatusBlockTone = 'success' | 'warning' | 'error' | 'neutral';

const TILE_CLASS: Record<Exclude<StatusBlockTone, 'neutral'>, string> = {
	success: 'bg-(--badge-success-bg) text-(--badge-success-text)',
	warning: 'bg-(--badge-amber-bg) text-(--badge-amber-text)',
	error: 'bg-(--badge-error-bg) text-(--badge-error-text)',
};
</script>

<script lang="ts">
import type { Snippet } from 'svelte';
import type { ClassValue } from 'svelte/elements';
import {
	ICON_STROKE_WIDTH,
	type IconComponent,
} from '#lib/components/icons/icon-component.ts';
import { cn } from '#lib/utils/utils.ts';

interface StatusBlockProps {
	icon: IconComponent;
	title: string;
	description?: string;
	tone?: StatusBlockTone;
	bordered?: boolean;
	details?: Snippet;
	actions?: Snippet;
	class?: ClassValue;
}

let {
	icon: Icon,
	title,
	description,
	tone = 'neutral',
	bordered = false,
	details,
	actions,
	class: className,
}: StatusBlockProps = $props();
</script>

<div
	role="status"
	class={cn(
		'flex flex-col items-center gap-y-3 px-4 py-6 text-center',
		bordered && 'rounded-2xl border border-border py-10',
		className
	)}
>
	{#if tone === 'neutral'}
		<span
			aria-hidden="true"
			class="flex items-center justify-center text-(--text-icon)"
		>
			<Icon class="size-6" strokeWidth={ICON_STROKE_WIDTH} />
		</span>
	{:else}
		<span
			aria-hidden="true"
			class={cn(
				'flex size-10 shrink-0 items-center justify-center rounded-full',
				TILE_CLASS[tone]
			)}
		>
			<Icon class="size-5" strokeWidth={ICON_STROKE_WIDTH} />
		</span>
	{/if}
	<div class="flex flex-col items-center">
		<h3 class="text-(--text-primary) text-base">{title}</h3>
		{#if description}
			<p class="max-w-md text-balance text-(--text-muted) text-sm">
				{description}
			</p>
		{/if}
	</div>
	{@render details?.()}
	{#if actions}
		<div class="mt-4 flex flex-col items-center gap-y-2">
			{@render actions()}
		</div>
	{/if}
</div>
