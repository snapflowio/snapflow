<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
export type EmptyStateSize = 'default' | 'lg';
</script>

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
	children?: Snippet;
	icon?: IconComponent;
	illustration?: boolean;
	bordered?: boolean;
	fill?: boolean;
	size?: EmptyStateSize;
	role?: 'status' | 'alert';
	class?: ClassValue;
}

let {
	title,
	description,
	actions,
	children,
	icon: Icon = Inbox,
	illustration = true,
	bordered = true,
	fill,
	size = 'default',
	role = 'status',
	class: className,
}: EmptyStateProps = $props();

const grows = $derived(fill ?? (!bordered || size === 'lg'));
</script>

<div
	{role}
	class={cn(
		'flex w-full flex-col items-center justify-center gap-3 rounded-2xl p-12 text-center',
		bordered && 'border border-border',
		grows && 'min-h-0 flex-1',
		className
	)}
>
	{#if illustration}
		<div
			aria-hidden="true"
			class="flex items-center justify-center text-(--text-icon)"
		>
			<Icon class="size-6" strokeWidth={ICON_STROKE_WIDTH} />
		</div>
	{/if}
	<div
		class="flex flex-col items-center text-center text-(--text-muted) text-sm [&_p]:max-w-md [&_p]:text-balance"
	>
		<h3 class="text-(--text-primary) text-base">{title}</h3>
		{#if description}
			<p>{description}</p>
		{/if}
		{@render children?.()}
	</div>
	{#if actions}
		<div class="mt-4 flex flex-wrap items-center justify-center gap-4">
			{@render actions()}
		</div>
	{/if}
</div>
