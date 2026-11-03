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

export type NoticeTone = 'default' | 'warning' | 'error' | 'success';

export interface NoticeProps {
	action?: Snippet;
	description?: Snippet;
	title: Snippet;
	tone?: NoticeTone;
	bleed?: boolean;
}

const NOTICE_TONES = {
	default: {
		surface: 'border-border bg-surface-2',
		title: 'text-(--text-body)',
	},
	error: {
		surface: 'border-(--destructive)/40 bg-(--badge-error-bg)',
		title: 'text-(--text-error)',
	},
	success: {
		surface: 'border-(--success)/40 bg-(--badge-success-bg)',
		title: 'text-(--text-success)',
	},
	warning: {
		surface: 'border-(--warning)/40 bg-(--badge-orange-bg)',
		title: 'text-(--badge-orange-text)',
	},
} as const satisfies Record<NoticeTone, { surface: string; title: string }>;
</script>

<script lang="ts">
import { cn } from '#lib/utils/utils.ts';

let {
	action,
	description,
	title,
	tone = 'default',
	bleed = false,
}: NoticeProps = $props();

const toneClasses = $derived(NOTICE_TONES[tone]);
</script>

{#snippet card()}
	<div
		role={tone === 'error' ? 'alert' : 'status'}
		class={cn(
			'flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between',
			toneClasses.surface
		)}
	>
		<div class="min-w-0">
			<p class={cn('text-small', toneClasses.title)}>{@render title()}</p>
			{#if description}
				<p class="mt-0.5 text-(--text-muted) text-caption">
					{@render description()}
				</p>
			{/if}
		</div>
		{#if action}
			<div class="shrink-0">{@render action()}</div>
		{/if}
	</div>
{/snippet}

{#if bleed}
	<div class="shrink-0 border-border border-b px-4 py-3">{@render card()}</div>
{:else}
	{@render card()}
{/if}
