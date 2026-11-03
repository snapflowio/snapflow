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
import type { HTMLAttributes } from 'svelte/elements';

export type FeedbackTone = 'muted' | 'error';
export type FeedbackVariant = 'fill' | 'inline';

interface FeedbackStateProps
	extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'role'> {
	message?: string | Snippet;
	children?: Snippet;
	action?: Snippet;
	tone?: FeedbackTone;
	variant?: FeedbackVariant;
	onRetry?: () => void;
	retrying?: boolean;
}
</script>

<script lang="ts">
import Chip from '#lib/components/ui/chip/chip.svelte';
import { cn } from '#lib/utils/utils.ts';

let {
	action,
	children,
	class: className,
	message,
	onRetry,
	retrying = false,
	tone = 'muted',
	variant = 'fill',
	...props
}: FeedbackStateProps = $props();
</script>

<div
	{...props}
	role={tone === 'error' ? 'alert' : 'status'}
	class={cn(
		'relative flex flex-col items-center justify-center text-center',
		variant === 'fill' ? 'min-h-40 gap-4 px-6 py-8' : 'gap-2 py-4',
		className
	)}
>
	<p
		class={cn(
			'max-w-md text-pretty text-sm',
			tone === 'error' ? 'text-(--text-error)' : 'text-(--text-muted)'
		)}
	>
		{#if typeof message === 'string'}
			{message}
		{:else if message}
			{@render message()}
		{:else}
			{@render children?.()}
		{/if}
	</p>
	{#if onRetry}
		<Chip variant="border" disabled={retrying} onclick={onRetry}>
			{retrying ? 'Retrying...' : 'Try again'}
		</Chip>
	{/if}
	{@render action?.()}
</div>
