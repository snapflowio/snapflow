<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import CircleAlert from '@lucide/svelte/icons/circle-alert';
import CircleCheck from '@lucide/svelte/icons/circle-check';
import Info from '@lucide/svelte/icons/info';
import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
import type { Snippet } from 'svelte';
import type { ClassValue } from 'svelte/elements';
import type { IconComponent } from '#lib/components/icons/icon-component.ts';

export type NoticeTone = 'info' | 'warning' | 'error' | 'success';

export interface NoticeProps {
	action?: Snippet;
	info?: string | Snippet;
	infoHref?: string;
	title: string | Snippet;
	tone?: NoticeTone;
	class?: ClassValue;
}

const NOTICE_TONES = {
	info: { icon: Info, color: 'text-(--text-primary)' },
	success: { icon: CircleCheck, color: 'text-(--success)' },
	warning: { icon: TriangleAlert, color: 'text-(--warning)' },
	error: { icon: CircleAlert, color: 'text-(--destructive)' },
} as const satisfies Record<NoticeTone, { icon: IconComponent; color: string }>;
</script>

<script lang="ts">
import InfoTooltip from '#lib/components/page/info-tooltip.svelte';
import { cn } from '#lib/utils/utils.ts';

let {
	action,
	info,
	infoHref,
	title,
	tone = 'info',
	class: className,
}: NoticeProps = $props();

const toneStyle = $derived(NOTICE_TONES[tone]);
</script>

<div
	role={tone === 'error' ? 'alert' : 'status'}
	class={cn(
		'grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 rounded-2xl border border-border bg-surface-1 px-6 py-4',
		action && 'sm:grid-cols-[auto_1fr_auto]',
		className
	)}
>
	<toneStyle.icon class={cn('size-4 shrink-0', toneStyle.color)} />
	<div class="flex min-w-0 items-center gap-1.5">
		<p class="min-w-0 text-pretty font-medium text-(--text-primary) text-sm">
			{#if typeof title === 'string'}
				{title}
			{:else}
				{@render title()}
			{/if}
		</p>
		{#if info}
			<InfoTooltip content={info} href={infoHref} />
		{/if}
	</div>
	{#if action}
		<div
			class="col-start-2 mt-3 flex flex-wrap items-center gap-2 sm:col-start-3 sm:row-start-1 sm:mt-0 sm:justify-self-end"
		>
			{@render action()}
		</div>
	{/if}
</div>
