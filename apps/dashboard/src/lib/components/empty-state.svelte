<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Inbox from '@lucide/svelte/icons/inbox';
import type { Snippet } from 'svelte';
import type { ClassValue } from 'svelte/elements';
import {
	ICON_STROKE_WIDTH,
	type IconComponent,
} from '#lib/components/icons/icon-component.ts';
import { cn } from '#lib/utils/utils.ts';

interface EmptyStateProps {
	title: string;
	description?: string;
	actions?: Snippet;
	icon?: IconComponent;
	illustration?: boolean;
	class?: ClassValue;
}

let {
	title,
	description,
	actions,
	icon: Icon = Inbox,
	illustration = true,
	class: className,
}: EmptyStateProps = $props();
</script>

<div
	role="status"
	class={cn(
		'flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-8 text-center animate-in fade-in-0 duration-200 motion-reduce:animate-none',
		className
	)}
>
	{#if illustration}
		<div
			aria-hidden="true"
			class="mb-4 size-11 rounded-xl border border-border bg-surface-4 p-0.75 shadow-xs"
		>
			<div
				class="flex size-full items-center justify-center rounded-[9px] border border-border bg-bg"
			>
				<Icon
					class="size-4.5 text-(--text-icon)"
					strokeWidth={ICON_STROKE_WIDTH}
				/>
			</div>
		</div>
	{/if}
	<p class="font-medium text-(--text-primary) text-small">{title}</p>
	{#if description}
		<p class="mt-1 max-w-72 text-(--text-muted) text-small leading-5">
			{description}
		</p>
	{/if}
	{#if actions}
		<div class="mt-4 flex gap-2">{@render actions()}</div>
	{/if}
</div>
